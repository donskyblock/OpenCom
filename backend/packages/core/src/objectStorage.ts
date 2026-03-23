import fs from "node:fs";
import { Readable } from "node:stream";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { env } from "./env.js";

const s3Enabled = env.STORAGE_PROVIDER === "s3";

const s3Client = s3Enabled
  ? new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials: env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
        ? {
            accessKeyId: env.S3_ACCESS_KEY_ID,
            secretAccessKey: env.S3_SECRET_ACCESS_KEY,
          }
        : undefined,
    })
  : null;

const s3KeyPrefix = normalizePrefix(env.S3_KEY_PREFIX || "");

export function isS3StorageEnabled() {
  return s3Enabled;
}

export async function uploadFileToObjectStorage(
  namespace: string,
  objectKey: string,
  absoluteFilePath: string,
  contentType?: string,
) {
  if (!s3Client) return;
  await s3Client.send(
    new PutObjectCommand({
      Bucket: env.CORE_S3_BUCKET,
      Key: resolveS3Key(namespace, objectKey),
      Body: fs.createReadStream(absoluteFilePath),
      ContentType: contentType,
    }),
  );
}

export async function uploadBufferToObjectStorage(
  namespace: string,
  objectKey: string,
  body: Buffer,
  contentType?: string,
) {
  if (!s3Client) return;
  await s3Client.send(
    new PutObjectCommand({
      Bucket: env.CORE_S3_BUCKET,
      Key: resolveS3Key(namespace, objectKey),
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function getObjectStreamFromStorage(
  namespace: string,
  objectKey: string,
): Promise<Readable | null> {
  if (!s3Client) return null;
  try {
    const result = await s3Client.send(
      new GetObjectCommand({
        Bucket: env.CORE_S3_BUCKET,
        Key: resolveS3Key(namespace, objectKey),
      }),
    );
    return toReadable(result.Body);
  } catch (error) {
    if (isS3NotFound(error)) return null;
    throw error;
  }
}

export async function deleteObjectFromStorage(namespace: string, objectKey: string) {
  if (!s3Client) return;
  try {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: env.CORE_S3_BUCKET,
        Key: resolveS3Key(namespace, objectKey),
      }),
    );
  } catch (error) {
    if (!isS3NotFound(error)) throw error;
  }
}

function resolveS3Key(namespace: string, objectKey: string) {
  const cleanNamespace = normalizePrefix(namespace);
  const cleanObjectKey = String(objectKey || "").replace(/^\/+/, "");
  return [s3KeyPrefix, cleanNamespace, cleanObjectKey].filter(Boolean).join("/");
}

function normalizePrefix(value: string) {
  return String(value || "").trim().replace(/^\/+/, "").replace(/\/+$/, "");
}

function toReadable(value: unknown): Readable | null {
  if (!value) return null;
  if (value instanceof Readable) return value;
  const candidate = value as {
    pipe?: unknown;
    transformToWebStream?: () => unknown;
    [Symbol.asyncIterator]?: () => AsyncIterator<Uint8Array>;
  };
  if (typeof candidate.pipe === "function") return candidate as unknown as Readable;
  if (typeof candidate.transformToWebStream === "function") {
    return Readable.fromWeb(candidate.transformToWebStream() as any);
  }
  if (typeof candidate[Symbol.asyncIterator] === "function") {
    return Readable.from(candidate as AsyncIterable<Uint8Array>);
  }
  return null;
}

function isS3NotFound(error: unknown) {
  const err = error as { name?: string; $metadata?: { httpStatusCode?: number } } | null;
  return err?.name === "NoSuchKey" || err?.$metadata?.httpStatusCode === 404;
}
