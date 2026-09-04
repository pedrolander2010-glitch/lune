import { UserInfo, SharedFile } from '../types';

const CHUNK_SIZE = 32 * 1024; // 32KB chunks for optimal WebRTC RTCDataChannel throughput

interface FileReceiveSession {
  fileId: string;
  name: string;
  size: number;
  mimeType: string;
  sender: UserInfo;
  totalChunks: number;
  receivedChunks: Map<number, Uint8Array>;
  receivedBytes: number;
  startTime: number;
}

const activeReceiveSessions = new Map<string, FileReceiveSession>();

export async function sendFileOverDataChannel(
  file: File,
  sender: UserInfo,
  sendChunk: (payload: any) => void,
  onProgress: (fileId: string, progress: number, status: 'transferring' | 'completed' | 'error') => void
) {
  const fileId = 'file_' + Math.random().toString(36).substring(2, 9);
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

  // Send metadata first
  sendChunk({
    type: 'file-meta',
    fileId,
    name: file.name,
    size: file.size,
    mimeType: file.type || 'application/octet-stream',
    totalChunks,
    sender,
  });

  onProgress(fileId, 0, 'transferring');

  const reader = file.stream().getReader();
  let chunkIndex = 0;
  let sentBytes = 0;
  let buffer = new Uint8Array(0);

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Accumulate
      const nextBuf = new Uint8Array(buffer.length + value.length);
      nextBuf.set(buffer);
      nextBuf.set(value, buffer.length);
      buffer = nextBuf;

      while (buffer.length >= CHUNK_SIZE) {
        const slice = buffer.slice(0, CHUNK_SIZE);
        buffer = buffer.slice(CHUNK_SIZE);

        let binary = '';
        for (let i = 0; i < slice.length; i++) {
          binary += String.fromCharCode(slice[i]);
        }
        const b64 = window.btoa(binary);

        sendChunk({
          type: 'file-chunk',
          fileId,
          chunkIndex,
          data: b64,
        });

        chunkIndex++;
        sentBytes += slice.length;
        const pct = Math.min(99, Math.round((sentBytes / file.size) * 100));
        onProgress(fileId, pct, 'transferring');
        // Give a 2ms yield for UI responsiveness
        await new Promise((r) => setTimeout(r, 2));
      }
    }

    // Send any remaining bytes
    if (buffer.length > 0) {
      let binary = '';
      for (let i = 0; i < buffer.length; i++) {
        binary += String.fromCharCode(buffer[i]);
      }
      const b64 = window.btoa(binary);

      sendChunk({
        type: 'file-chunk',
        fileId,
        chunkIndex,
        data: b64,
      });
      sentBytes += buffer.length;
    }

    onProgress(fileId, 100, 'completed');
  } catch (err) {
    console.error('File send error:', err);
    onProgress(fileId, 0, 'error');
  }
}

export function handleIncomingFileChunk(
  chunkData: any,
  onFileProgress: (file: SharedFile) => void
) {
  if (chunkData.type === 'file-meta') {
    const session: FileReceiveSession = {
      fileId: chunkData.fileId,
      name: chunkData.name,
      size: chunkData.size,
      mimeType: chunkData.mimeType,
      sender: chunkData.sender,
      totalChunks: chunkData.totalChunks,
      receivedChunks: new Map(),
      receivedBytes: 0,
      startTime: Date.now(),
    };
    activeReceiveSessions.set(chunkData.fileId, session);

    onFileProgress({
      id: session.fileId,
      name: session.name,
      size: session.size,
      mimeType: session.mimeType,
      sender: session.sender,
      progress: 0,
      status: 'transferring',
      timestamp: session.startTime,
    });
    return;
  }

  if (chunkData.type === 'file-chunk') {
    const session = activeReceiveSessions.get(chunkData.fileId);
    if (!session) return;

    // Decode base64 chunk
    const binary = window.atob(chunkData.data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    session.receivedChunks.set(chunkData.chunkIndex, bytes);
    session.receivedBytes += bytes.length;

    const progress = Math.min(100, Math.round((session.receivedChunks.size / session.totalChunks) * 100));

    if (session.receivedChunks.size >= session.totalChunks) {
      // Reconstruct file
      const sortedChunks: Uint8Array[] = [];
      for (let i = 0; i < session.totalChunks; i++) {
        if (session.receivedChunks.has(i)) {
          sortedChunks.push(session.receivedChunks.get(i)!);
        }
      }

      const blob = new Blob(sortedChunks as BlobPart[], { type: session.mimeType });
      const dataUrl = URL.createObjectURL(blob);

      onFileProgress({
        id: session.fileId,
        name: session.name,
        size: session.size,
        mimeType: session.mimeType,
        sender: session.sender,
        dataUrl,
        progress: 100,
        status: 'completed',
        timestamp: session.startTime,
      });

      activeReceiveSessions.delete(session.fileId);
    } else {
      onFileProgress({
        id: session.fileId,
        name: session.name,
        size: session.size,
        mimeType: session.mimeType,
        sender: session.sender,
        progress,
        status: 'transferring',
        timestamp: session.startTime,
      });
    }
  }
}
