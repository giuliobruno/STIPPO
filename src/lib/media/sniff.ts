/**
 * Magic-byte MIME sniffing for uploads / AI gateway.
 * Rejects empty or spoofed Content-Type when bytes disagree.
 */

export type SniffedMime =
  | "image/jpeg"
  | "image/png"
  | "image/gif"
  | "image/webp"
  | "application/pdf"
  | "audio/mpeg"
  | "audio/wav"
  | "audio/webm"
  | "video/webm"
  | "video/mp4"
  | null;

export function sniffMime(bytes: ArrayBuffer | Uint8Array | Buffer): SniffedMime {
  const u8 =
    bytes instanceof Uint8Array
      ? bytes
      : new Uint8Array(bytes);

  if (u8.length < 12) return null;

  // JPEG
  if (u8[0] === 0xff && u8[1] === 0xd8 && u8[2] === 0xff) return "image/jpeg";
  // PNG
  if (
    u8[0] === 0x89 &&
    u8[1] === 0x50 &&
    u8[2] === 0x4e &&
    u8[3] === 0x47
  ) {
    return "image/png";
  }
  // GIF
  if (
    u8[0] === 0x47 &&
    u8[1] === 0x49 &&
    u8[2] === 0x46 &&
    u8[3] === 0x38
  ) {
    return "image/gif";
  }
  // WEBP (RIFF....WEBP)
  if (
    u8[0] === 0x52 &&
    u8[1] === 0x49 &&
    u8[2] === 0x46 &&
    u8[3] === 0x46 &&
    u8[8] === 0x57 &&
    u8[9] === 0x45 &&
    u8[10] === 0x42 &&
    u8[11] === 0x50
  ) {
    return "image/webp";
  }
  // PDF
  if (
    u8[0] === 0x25 &&
    u8[1] === 0x50 &&
    u8[2] === 0x44 &&
    u8[3] === 0x46
  ) {
    return "application/pdf";
  }
  // WAV
  if (
    u8[0] === 0x52 &&
    u8[1] === 0x49 &&
    u8[2] === 0x46 &&
    u8[3] === 0x46 &&
    u8[8] === 0x57 &&
    u8[9] === 0x41 &&
    u8[10] === 0x56 &&
    u8[11] === 0x45
  ) {
    return "audio/wav";
  }
  // WebM / Matroska
  if (
    u8[0] === 0x1a &&
    u8[1] === 0x45 &&
    u8[2] === 0xdf &&
    u8[3] === 0xa3
  ) {
    return "video/webm";
  }
  // MP3 with ID3
  if (u8[0] === 0x49 && u8[1] === 0x44 && u8[2] === 0x33) return "audio/mpeg";
  // MP3 frame sync
  if (u8[0] === 0xff && (u8[1]! & 0xe0) === 0xe0) return "audio/mpeg";
  // MP4 / M4A (ftyp)
  if (
    u8[4] === 0x66 &&
    u8[5] === 0x74 &&
    u8[6] === 0x79 &&
    u8[7] === 0x70
  ) {
    return "video/mp4";
  }

  return null;
}

/** Normalize declared MIME; reject empty or mismatched vs magic bytes. */
export function assertAllowedUploadMime(opts: {
  declaredMime: string;
  bytes: ArrayBuffer | Uint8Array | Buffer;
  allowed: readonly string[];
}): { mime: string } {
  const declared = (opts.declaredMime || "").toLowerCase().trim();
  const sniffed = sniffMime(opts.bytes);

  if (!declared && !sniffed) {
    throw Object.assign(new Error("Missing or unrecognized file type."), {
      status: 415,
    });
  }

  const mime = sniffed || declared;
  const ok = opts.allowed.some(
    (p) => mime === p || (p.endsWith("/") && mime.startsWith(p))
  );
  if (!ok) {
    throw Object.assign(new Error("Unsupported file type."), { status: 415 });
  }

  if (sniffed && declared && !mimeCompatible(declared, sniffed)) {
    throw Object.assign(
      new Error("File content does not match declared type."),
      { status: 415 }
    );
  }

  return { mime: sniffed || declared };
}

function mimeCompatible(declared: string, sniffed: string): boolean {
  if (declared === sniffed) return true;
  if (declared === "image/jpg" && sniffed === "image/jpeg") return true;
  if (declared === "audio/mp3" && sniffed === "audio/mpeg") return true;
  if (declared === "audio/webm" && sniffed === "video/webm") return true;
  if (declared.startsWith("audio/") && sniffed === "video/mp4") return true; // m4a
  return false;
}
