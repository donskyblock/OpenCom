import { useEffect, useMemo, useState } from "react";

export function getAvatarInitials(label = "", maxLetters = 1) {
  const clean = String(label || "").trim();
  if (!clean) return "?";
  return clean
    .split(/\s+/)
    .slice(0, Math.max(1, maxLetters))
    .map((part) => part[0] || "")
    .join("")
    .toUpperCase();
}

function getAvatarBackground(seed = "") {
  const normalized = String(seed || "?");
  const hue = normalized
    .split("")
    .reduce((total, char) => total + char.charCodeAt(0), 0) % 360;
  return `linear-gradient(145deg, hsl(${hue}, 62%, 54%), hsl(${(hue + 36) % 360}, 78%, 68%))`;
}

export function SafeAvatar({
  src,
  alt,
  name,
  seed,
  className = "",
  style,
  imgClassName = "",
  imgStyle,
  fallbackClassName = "",
  fallbackStyle,
  maxLetters = 1,
}) {
  const resolvedSrc = String(src || "").trim();
  const [hasError, setHasError] = useState(!resolvedSrc);

  useEffect(() => {
    setHasError(!resolvedSrc);
  }, [resolvedSrc]);

  const initials = useMemo(
    () => getAvatarInitials(name || alt || "?", maxLetters),
    [alt, maxLetters, name],
  );

  const wrapperStyle = hasError
    ? {
        display: style?.display || "grid",
        placeItems: style?.placeItems || "center",
        background: style?.background || getAvatarBackground(seed || name || alt),
        overflow: style?.overflow || "hidden",
        color: style?.color || "#fff",
        fontWeight: style?.fontWeight || 700,
        ...style,
      }
    : {
        overflow: style?.overflow || "hidden",
        ...style,
      };

  return (
    <div className={className} style={wrapperStyle}>
      {!hasError ? (
        <img
          src={resolvedSrc}
          alt={alt || name || "Avatar"}
          className={imgClassName}
          style={imgStyle}
          onError={() => setHasError(true)}
        />
      ) : (
        <span className={fallbackClassName} style={fallbackStyle}>
          {initials}
        </span>
      )}
    </div>
  );
}
