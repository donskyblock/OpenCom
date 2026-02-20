import * as mediasoupClient from "mediasoup-client";

const DEFAULT_TIMEOUT_MS = 10000;

export function createSfuVoiceClient({
  selfUserId,
  getSelfUserId,
  sendDispatch,
  waitForEvent,
  onLocalAudioProcessingInfo,
  onRemoteAudioAdded,
  onRemoteAudioRemoved,
  onRemoteVideoAdded,
  onRemoteVideoRemoved,
  onScreenShareStateChange
}) {
  const state = {
    sessionToken: 0,
    guildId: "",
    channelId: "",
    device: null,
    sendTransport: null,
    recvTransport: null,
    localAudioProducer: null,
    localScreenProducer: null,
    localStream: null,
    localScreenStream: null,
    localScreenTrackEndedHandler: null,
    consumersByProducerId: new Map(),
    producerOwnerByProducerId: new Map(),
    isMuted: false,
    isDeafened: false,
    noiseSuppression: true,
    audioInputDeviceId: "",
    audioOutputDeviceId: "",
    pendingAudioStartByProducerId: new Map(),
    userAudioPrefsByUserId: new Map()
  };

  function normalizeUserAudioPreference(pref = {}) {
    const muted = !!pref?.muted;
    const volumeRaw = Number(pref?.volume);
    const volume = Number.isFinite(volumeRaw) ? Math.max(0, Math.min(100, volumeRaw)) : 100;
    return { muted, volume };
  }

  function applyAudioPreferenceToAudio(audio, userId) {
    if (!audio) return;
    if (state.isDeafened) {
      audio.volume = 0;
      return;
    }
    const pref = normalizeUserAudioPreference(state.userAudioPrefsByUserId.get(userId) || {});
    audio.volume = pref.muted ? 0 : pref.volume / 100;
  }

  function removePendingAudioStart(producerId) {
    const pending = state.pendingAudioStartByProducerId.get(producerId);
    if (!pending) return;
    pending.cleanup();
    state.pendingAudioStartByProducerId.delete(producerId);
  }

  function scheduleAudioStartRetry(audio, producerId) {
    if (!audio || !producerId || state.pendingAudioStartByProducerId.has(producerId)) return;

    const retryStart = () => {
      if (audio.paused) {
        audio.play()
          .then(() => {
            removePendingAudioStart(producerId);
          })
          .catch(() => {});
      } else {
        removePendingAudioStart(producerId);
      }
    };

    const events = ["pointerdown", "touchstart", "keydown", "click"];
    events.forEach((eventName) => window.addEventListener(eventName, retryStart, { passive: true }));
    const timer = window.setInterval(retryStart, 1500);

    state.pendingAudioStartByProducerId.set(producerId, {
      cleanup: () => {
        window.clearInterval(timer);
        events.forEach((eventName) => window.removeEventListener(eventName, retryStart));
      }
    });
  }

  function isActive(token) {
    return token === state.sessionToken && !!state.channelId;
  }

  function setScreenSharing(active) {
    onScreenShareStateChange?.(!!active);
  }

  function resolveSelfUserId() {
    return getSelfUserId?.() || selfUserId || "";
  }

  function emitLocalAudioProcessingInfo(localTrack) {
    const trackSettings = localTrack && typeof localTrack.getSettings === "function" ? localTrack.getSettings() : {};
    const supportedConstraints = navigator.mediaDevices?.getSupportedConstraints?.() || {};
    onLocalAudioProcessingInfo?.({
      requested: {
        noiseSuppression: !!state.noiseSuppression,
        echoCancellation: true,
        autoGainControl: true
      },
      applied: {
        noiseSuppression: typeof trackSettings.noiseSuppression === "boolean" ? trackSettings.noiseSuppression : null,
        echoCancellation: typeof trackSettings.echoCancellation === "boolean" ? trackSettings.echoCancellation : null,
        autoGainControl: typeof trackSettings.autoGainControl === "boolean" ? trackSettings.autoGainControl : null
      },
      supported: {
        noiseSuppression: !!supportedConstraints.noiseSuppression,
        echoCancellation: !!supportedConstraints.echoCancellation,
        autoGainControl: !!supportedConstraints.autoGainControl
      }
    });
  }

  async function replaceLocalAudioTrack(newTrack) {
    if (!newTrack) return;
    const oldTrack = state.localStream?.getAudioTracks?.()?.[0] || null;
    const nextStream = new MediaStream([newTrack]);
    state.localStream = nextStream;
    if (state.localAudioProducer) {
      await state.localAudioProducer.replaceTrack({ track: newTrack });
      if (state.isMuted) {
        state.localAudioProducer.pause();
        newTrack.enabled = false;
      } else {
        state.localAudioProducer.resume();
        newTrack.enabled = true;
      }
    }
    if (oldTrack && oldTrack !== newTrack) {
      try { oldTrack.stop(); } catch {}
    }
    emitLocalAudioProcessingInfo(newTrack);
  }

  async function setNoiseSuppression(nextNoiseSuppression) {
    state.noiseSuppression = !!nextNoiseSuppression;
    const currentTrack = state.localStream?.getAudioTracks?.()?.[0];
    if (!currentTrack) return;

    const requestedConstraints = {
      echoCancellation: true,
      noiseSuppression: !!state.noiseSuppression,
      autoGainControl: true
    };

    try {
      if (typeof currentTrack.applyConstraints === "function") {
        await currentTrack.applyConstraints(requestedConstraints);
      }
      emitLocalAudioProcessingInfo(currentTrack);
      return;
    } catch {
      // Some devices/browsers ignore or fail applyConstraints; reacquire and replace track.
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...requestedConstraints,
          ...(state.audioInputDeviceId ? { deviceId: { exact: state.audioInputDeviceId } } : {})
        }
      });
      const nextTrack = stream.getAudioTracks?.()[0];
      if (!nextTrack) return;
      await replaceLocalAudioTrack(nextTrack);
    } catch {
      emitLocalAudioProcessingInfo(currentTrack);
    }
  }

  async function setAudioInputDevice(nextAudioInputDeviceId) {
    state.audioInputDeviceId = nextAudioInputDeviceId || "";
    const currentTrack = state.localStream?.getAudioTracks?.()?.[0];
    if (!currentTrack) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: !!state.noiseSuppression,
          autoGainControl: true,
          ...(state.audioInputDeviceId ? { deviceId: { exact: state.audioInputDeviceId } } : {})
        }
      });
      const nextTrack = stream.getAudioTracks?.()[0];
      if (!nextTrack) return;
      await replaceLocalAudioTrack(nextTrack);
    } catch {
      emitLocalAudioProcessingInfo(currentTrack);
    }
  }

  function getDesktopBridge() {
    if (typeof window === "undefined") return null;
    return window.opencomDesktopBridge || null;
  }

  async function getDesktopFallbackDisplayStream() {
    const bridge = getDesktopBridge();
    if (!bridge?.getDisplaySources || !navigator?.mediaDevices?.getUserMedia) {
      throw new Error("SCREEN_SHARE_NOT_SUPPORTED");
    }

    const sources = await bridge.getDisplaySources();
    if (!Array.isArray(sources) || sources.length === 0) {
      throw new Error("SCREEN_SOURCE_NOT_FOUND");
    }
    const preferred = sources.find((source) => source?.type === "screen") || sources[0];
    if (!preferred?.id) throw new Error("SCREEN_SOURCE_NOT_FOUND");

    return navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: "desktop",
          chromeMediaSourceId: preferred.id,
          maxFrameRate: 30
        }
      }
    });
  }

  async function waitDispatch(type, match, timeoutMs = DEFAULT_TIMEOUT_MS) {
    return waitForEvent({ type, match, timeoutMs, guildId: state.guildId, channelId: state.channelId, sessionToken: state.sessionToken });
  }

  async function waitForTransportConnected(transportId, timeoutMs = DEFAULT_TIMEOUT_MS) {
    return waitForEvent({
      type: "VOICE_TRANSPORT_CONNECTED",
      timeoutMs,
      guildId: state.guildId,
      channelId: state.channelId,
      sessionToken: state.sessionToken,
      transportId
    });
  }

  async function waitForVoiceError(timeoutMs = DEFAULT_TIMEOUT_MS) {
    return waitForEvent({
      type: "VOICE_ERROR",
      timeoutMs,
      guildId: state.guildId,
      channelId: state.channelId,
      sessionToken: state.sessionToken
    });
  }

  async function waitForVoiceResponse(waitForSuccess, timeoutMs = DEFAULT_TIMEOUT_MS) {
    const successPromise = waitForSuccess();
    const errorPromise = waitForVoiceError(timeoutMs).then((errorData) => {
      throw new Error(`VOICE_ERROR: ${errorData?.error || "UNKNOWN"}`);
    });
    return Promise.race([successPromise, errorPromise]);
  }

  async function createTransport(direction, token) {
    await sendDispatch("VOICE_CREATE_TRANSPORT", { guildId: state.guildId, channelId: state.channelId, direction });
    const created = await waitDispatch("VOICE_TRANSPORT_CREATED", (d) => d?.direction === direction);
    if (!isActive(token)) throw new Error("VOICE_SESSION_CANCELLED");
    return direction === "send"
      ? state.device.createSendTransport(created.transport)
      : state.device.createRecvTransport(created.transport);
  }

  async function consumeProducer(producerId, userId, token) {
    if (!producerId || !state.recvTransport || !state.device || !isActive(token)) return;
    if (state.consumersByProducerId.has(producerId)) return;

    await sendDispatch("VOICE_CONSUME", {
      guildId: state.guildId,
      channelId: state.channelId,
      transportId: state.recvTransport.id,
      producerId,
      rtpCapabilities: state.device.rtpCapabilities
    });

    const consumerOptions = await waitForVoiceResponse(
      () => waitDispatch("VOICE_CONSUMED", (d) => d?.producerId === producerId)
    );
    if (!isActive(token)) return;

    const consumer = await state.recvTransport.consume(consumerOptions);
    const stream = new MediaStream([consumer.track]);
    if (consumer.kind === "audio") {
      const audio = document.createElement("audio");
      audio.autoplay = true;
      audio.playsInline = true;
      audio.preload = "auto";
      audio.muted = false;
      audio.srcObject = stream;
      audio.style.display = "none";
      document.body.appendChild(audio);
      audio.addEventListener("loadedmetadata", () => {
        if (audio.paused) {
          audio.play().catch(() => {
            scheduleAudioStartRetry(audio, producerId);
          });
        }
      });
      if (typeof audio.setSinkId === "function" && state.audioOutputDeviceId) {
        await audio.setSinkId(state.audioOutputDeviceId).catch(() => {});
      }
      applyAudioPreferenceToAudio(audio, userId || "");
      await audio.play().catch(() => {
        scheduleAudioStartRetry(audio, producerId);
      });
      state.consumersByProducerId.set(producerId, {
        consumer,
        audio,
        stream,
        kind: "audio",
        userId: userId || ""
      });
      if (userId) state.producerOwnerByProducerId.set(producerId, userId);
      onRemoteAudioAdded?.({ producerId, guildId: state.guildId, channelId: state.channelId, userId, audio });
      return;
    }

    state.consumersByProducerId.set(producerId, {
      consumer,
      stream,
      kind: consumer.kind,
      userId: userId || ""
    });
    if (userId) state.producerOwnerByProducerId.set(producerId, userId);
    onRemoteVideoAdded?.({ producerId, userId, stream, kind: consumer.kind });
  }

  async function join({
    guildId,
    channelId,
    audioInputDeviceId,
    noiseSuppression = true,
    isMuted = false,
    isDeafened = false,
    audioOutputDeviceId = ""
  }) {
    await cleanup();
    state.sessionToken += 1;
    const token = state.sessionToken;
    state.guildId = guildId;
    state.channelId = channelId;
    state.isMuted = !!isMuted;
    state.isDeafened = !!isDeafened;
    state.noiseSuppression = !!noiseSuppression;
    state.audioInputDeviceId = audioInputDeviceId || "";
    state.audioOutputDeviceId = audioOutputDeviceId || "";

    await sendDispatch("VOICE_JOIN", { guildId, channelId });
    const joined = await waitForEvent({
      type: "VOICE_JOINED",
      match: (d) => d?.guildId === guildId && d?.channelId === channelId,
      timeoutMs: 12000,
      guildId,
      channelId,
      sessionToken: token
    });
    if (!isActive(token)) throw new Error("VOICE_SESSION_CANCELLED");

    state.device = new mediasoupClient.Device();
    await state.device.load({ routerRtpCapabilities: joined.rtpCapabilities });

    state.sendTransport = await createTransport("send", token);
    state.sendTransport.on("connect", async ({ dtlsParameters }, callback, errback) => {
      try {
        if (import.meta.env.DEV) {
          console.debug("[voice] sending VOICE_CONNECT_TRANSPORT", {
            transportId: state.sendTransport.id,
            guildId: state.guildId,
            channelId: state.channelId
          });
        }
        await sendDispatch("VOICE_CONNECT_TRANSPORT", {
          guildId: state.guildId,
          channelId: state.channelId,
          transportId: state.sendTransport.id,
          dtlsParameters
        });
        await waitForVoiceResponse(() => waitForTransportConnected(state.sendTransport.id));
        callback();
      } catch (error) {
        errback(error);
      }
    });
    state.sendTransport.on("produce", async ({ kind, rtpParameters }, callback, errback) => {
      try {
        await sendDispatch("VOICE_PRODUCE", {
          guildId: state.guildId,
          channelId: state.channelId,
          transportId: state.sendTransport.id,
          kind,
          rtpParameters
        });
        const produced = await waitForVoiceResponse(
          () => waitDispatch(
            "VOICE_PRODUCED",
            (d) =>
              d?.guildId === state.guildId &&
              d?.channelId === state.channelId &&
              d?.userId === resolveSelfUserId()
          )
        );
        callback({ id: produced.producerId });
      } catch (error) {
        errback(error);
      }
    });

    const audioConstraints = {
      echoCancellation: true,
      noiseSuppression: !!state.noiseSuppression,
      autoGainControl: true,
      ...(state.audioInputDeviceId ? { deviceId: { exact: state.audioInputDeviceId } } : {})
    };
    state.localStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
    const localTrack = state.localStream.getAudioTracks()[0];
    if (!localTrack) throw new Error("MIC_TRACK_NOT_FOUND");
    emitLocalAudioProcessingInfo(localTrack);
    state.localAudioProducer = await state.sendTransport.produce({ track: localTrack });
    if (state.isMuted) {
      state.localAudioProducer.pause();
      localTrack.enabled = false;
    }

    state.recvTransport = await createTransport("recv", token);
    state.recvTransport.on("connect", async ({ dtlsParameters }, callback, errback) => {
      try {
        if (import.meta.env.DEV) {
          console.debug("[voice] sending VOICE_CONNECT_TRANSPORT", {
            transportId: state.recvTransport.id,
            guildId: state.guildId,
            channelId: state.channelId
          });
        }
        await sendDispatch("VOICE_CONNECT_TRANSPORT", {
          guildId: state.guildId,
          channelId: state.channelId,
          transportId: state.recvTransport.id,
          dtlsParameters
        });
        await waitForVoiceResponse(() => waitForTransportConnected(state.recvTransport.id));
        callback();
      } catch (error) {
        errback(error);
      }
    });

    for (const producer of joined.producers || []) {
      await consumeProducer(producer.producerId, producer.userId, token);
    }
  }

  async function cleanupConsumer(producerId) {
    const entry = state.consumersByProducerId.get(producerId);
    if (!entry) return;
    state.consumersByProducerId.delete(producerId);
    state.producerOwnerByProducerId.delete(producerId);
    removePendingAudioStart(producerId);
    try { entry.consumer.close(); } catch {}
    if (entry.audio) {
      try { entry.audio.pause(); entry.audio.srcObject = null; entry.audio.remove(); } catch {}
      onRemoteAudioRemoved?.({ producerId, userId: entry.userId || "" });
      return;
    }
    onRemoteVideoRemoved?.({ producerId, userId: entry.userId || "" });
  }

  function clearLocalScreenState({ stopTracks = false } = {}) {
    if (state.localScreenStream) {
      const track = state.localScreenStream.getVideoTracks()?.[0];
      if (track && state.localScreenTrackEndedHandler) {
        track.removeEventListener("ended", state.localScreenTrackEndedHandler);
      }
      if (stopTracks) {
        state.localScreenStream.getTracks().forEach((currentTrack) => currentTrack.stop());
      }
    }
    state.localScreenTrackEndedHandler = null;
    state.localScreenStream = null;
    state.localScreenProducer = null;
    setScreenSharing(false);
  }

  async function stopScreenShare({ notifyServer = true } = {}) {
    if (!state.localScreenProducer) {
      clearLocalScreenState({ stopTracks: true });
      return;
    }

    const producerId = state.localScreenProducer.id;
    try { state.localScreenProducer.close(); } catch {}
    clearLocalScreenState({ stopTracks: true });

    if (!notifyServer || !producerId || !state.guildId || !state.channelId) return;
    await sendDispatch("VOICE_CLOSE_PRODUCER", {
      guildId: state.guildId,
      channelId: state.channelId,
      producerId
    }).catch(() => {});
  }

  async function startScreenShare() {
    if (!state.sendTransport || !state.guildId || !state.channelId) {
      throw new Error("NOT_IN_VOICE_CHANNEL");
    }
    if (state.localScreenProducer) return;
    let displayStream = null;
    if (navigator.mediaDevices?.getDisplayMedia) {
      try {
        displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      } catch (error) {
        displayStream = await getDesktopFallbackDisplayStream().catch(() => {
          throw error;
        });
      }
    } else {
      displayStream = await getDesktopFallbackDisplayStream();
    }
    const screenTrack = displayStream.getVideoTracks()[0];
    if (!screenTrack) {
      displayStream.getTracks().forEach((track) => track.stop());
      throw new Error("SCREEN_TRACK_NOT_FOUND");
    }

    try {
      const producer = await state.sendTransport.produce({
        track: screenTrack,
        appData: { source: "screen" }
      });
      state.localScreenProducer = producer;
      state.localScreenStream = displayStream;
      const endedHandler = () => {
        stopScreenShare().catch(() => {});
      };
      state.localScreenTrackEndedHandler = endedHandler;
      screenTrack.addEventListener("ended", endedHandler);
      setScreenSharing(true);
    } catch (error) {
      displayStream.getTracks().forEach((track) => track.stop());
      clearLocalScreenState({ stopTracks: false });
      throw error;
    }
  }

  async function cleanup() {
    state.sessionToken += 1;
    for (const producerId of [...state.pendingAudioStartByProducerId.keys()]) {
      removePendingAudioStart(producerId);
    }
    for (const producerId of [...state.consumersByProducerId.keys()]) {
      await cleanupConsumer(producerId);
    }
    await stopScreenShare({ notifyServer: false }).catch(() => {});
    try { state.localAudioProducer?.close(); } catch {}
    state.localAudioProducer = null;
    if (state.localStream) {
      state.localStream.getTracks().forEach((track) => track.stop());
      state.localStream = null;
    }
    try { state.sendTransport?.close(); } catch {}
    state.sendTransport = null;
    try { state.recvTransport?.close(); } catch {}
    state.recvTransport = null;
    state.device = null;
    state.guildId = "";
    state.channelId = "";
  }

  async function handleGatewayDispatch(type, data) {
    if (!state.channelId || !state.guildId) return;
    if (data?.guildId && data.guildId !== state.guildId) return;
    if (data?.channelId && data.channelId !== state.channelId) return;
    if (state.localAudioProducer && data.producerId === state.localAudioProducer.id) return;
    if (state.localScreenProducer && data.producerId === state.localScreenProducer.id) return;


    if (type === "VOICE_NEW_PRODUCER" && data?.producerId) {
      if (data.userId && data.userId === resolveSelfUserId()) return; // ignore self
        await consumeProducer(data.producerId, data.userId, state.sessionToken).catch(() => {});
        return;
      }
      

    if (type === "VOICE_PRODUCER_CLOSED" && data?.producerId) {
      await cleanupConsumer(data.producerId);
      return;
    }

    if (type === "VOICE_USER_LEFT" && data?.userId) {
      closeConsumersForUser(data.userId);
    }
  }

  function closeConsumersForUser(userId) {
    if (!userId) return;
    const producerIds = [...state.producerOwnerByProducerId.entries()]
      .filter(([, owner]) => owner === userId)
      .map(([producerId]) => producerId);
    producerIds.forEach((producerId) => {
      cleanupConsumer(producerId).catch(() => {});
    });
  }

  function setMuted(nextMuted) {
    state.isMuted = !!nextMuted;
    const track = state.localStream?.getAudioTracks?.()[0];
    if (state.localAudioProducer) {
      if (state.isMuted) state.localAudioProducer.pause();
      else state.localAudioProducer.resume();
    }
    if (track) track.enabled = !state.isMuted;
  }

  function setDeafened(nextDeafened) {
    state.isDeafened = !!nextDeafened;
    for (const { audio, userId } of state.consumersByProducerId.values()) {
      if (!audio) continue;
      applyAudioPreferenceToAudio(audio, userId || "");
    }
  }

  function setUserAudioPreference(userId, pref = {}) {
    const key = String(userId || "").trim();
    if (!key) return;
    state.userAudioPrefsByUserId.set(key, normalizeUserAudioPreference(pref));
    for (const { audio, userId: ownerId } of state.consumersByProducerId.values()) {
      if (!audio || ownerId !== key) continue;
      applyAudioPreferenceToAudio(audio, key);
    }
  }

  function setAudioOutputDevice(deviceId) {
    state.audioOutputDeviceId = deviceId || "";
    for (const { audio } of state.consumersByProducerId.values()) {
      if (!audio) continue;
      if (typeof audio.setSinkId === "function" && state.audioOutputDeviceId) {
        audio.setSinkId(state.audioOutputDeviceId).catch(() => {});
      }
    }
  }

  function getLocalStream() {
    return state.localStream;
  }

  function getContext() {
    return { guildId: state.guildId, channelId: state.channelId };
  }

  return {
    join,
    cleanup,
    handleGatewayDispatch,
    closeConsumersForUser,
    setMuted,
    setDeafened,
    setNoiseSuppression,
    setAudioInputDevice,
    setUserAudioPreference,
    setAudioOutputDevice,
    startScreenShare,
    stopScreenShare,
    getLocalStream,
    getContext
  };
}
