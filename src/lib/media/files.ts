/** Allowed work-file imports for the vault (local-first). */

export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;

const BLOCKED_EXTENSIONS = new Set([
  "exe",
  "bat",
  "cmd",
  "com",
  "msi",
  "scr",
  "js",
  "mjs",
  "vbs",
  "ps1",
  "sh",
  "dll",
  "apk",
  "dmg",
  "app",
]);

const ALLOWED_EXTENSIONS = new Set([
  "pdf",
  "doc",
  "docx",
  "odt",
  "rtf",
  "txt",
  "md",
  "csv",
  "tsv",
  "xls",
  "xlsx",
  "ods",
  "ppt",
  "pptx",
  "odp",
  "json",
  "xml",
  "dwg",
  "dxf",
  "ifc",
  "rvt",
  "pages",
  "numbers",
  "key",
  "zip",
]);

const ALLOWED_MIME_PREFIXES = [
  "application/pdf",
  "application/msword",
  "application/vnd.",
  "application/rtf",
  "application/json",
  "application/xml",
  "application/zip",
  "text/",
];

export function fileExtension(name: string): string {
  const i = name.lastIndexOf(".");
  if (i < 0) return "";
  return name.slice(i + 1).toLowerCase();
}

export function isPdfFile(file: { name?: string; type?: string }): boolean {
  const mime = (file.type || "").toLowerCase();
  if (mime === "application/pdf") return true;
  return fileExtension(file.name || "") === "pdf";
}

export function isDocumentFile(file: File): boolean {
  if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
    return false;
  }
  const ext = fileExtension(file.name);
  if (BLOCKED_EXTENSIONS.has(ext)) return false;
  if (ALLOWED_EXTENSIONS.has(ext)) return true;
  const mime = (file.type || "").toLowerCase();
  if (!mime || mime === "application/octet-stream") {
    // Unknown binary with no allowlisted extension — reject
    return false;
  }
  return ALLOWED_MIME_PREFIXES.some((p) => mime === p || mime.startsWith(p));
}

export function validateDocumentFile(file: File): string | null {
  if (!isDocumentFile(file)) {
    return "unsupported";
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    return "too_large";
  }
  return null;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export const DOCUMENT_ACCEPT =
  ".pdf,.doc,.docx,.odt,.rtf,.txt,.md,.csv,.xls,.xlsx,.ppt,.pptx,.json,.xml,.dwg,.dxf,.ifc,.zip,application/pdf,text/*,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation";
