import { UserInfo, StreamConfig, NetworkMetrics } from '../types';

export const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

export interface PeerItem {
  peerId: string;
  user: UserInfo;
  pc: RTCPeerConnection;
  stream?: MediaStream;
  dataChannel?: RTCDataChannel;
  connectionState: RTCPeerConnectionState;
  metrics: NetworkMetrics;
}

export type SignalSender = (toUserId: string, signalData: any) => void;

export class WebRTCManager {
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private peers: Map<string, PeerItem> = new Map();
  private sendSignal: SignalSender;
  private onPeersChange: (peers: PeerItem[]) => void;
  private onDataMessage: (fromUser: UserInfo, data: any) => void;
  private onFileChunk: (fromUser: UserInfo, chunk: any) => void;
  private statsInterval: any = null;

  constructor(
    sendSignal: SignalSender,
    onPeersChange: (peers: PeerItem[]) => void,
    onDataMessage: (fromUser: UserInfo, data: any) => void,
    onFileChunk: (fromUser: UserInfo, chunk: any) => void
  ) {
    this.sendSignal = sendSignal;
    this.onPeersChange = onPeersChange;
    this.onDataMessage = onDataMessage;
    this.onFileChunk = onFileChunk;

    this.startStatsPolling();
  }

  public setLocalStream(stream: MediaStream | null) {
    this.localStream = stream;
    this.updateLocalTracks();
  }

  public setScreenStream(stream: MediaStream | null) {
    this.screenStream = stream;
    this.updateLocalTracks();
  }

  public getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  public getScreenStream(): MediaStream | null {
    return this.screenStream;
  }

  /**
   * Acquire local camera & microphone with requested FPS and resolution
   */
  public async startLocalMedia(config: StreamConfig): Promise<MediaStream> {
    const width = config.resolution === '1080p' ? 1920 : config.resolution === '720p' ? 1280 : 640;
    const height = config.resolution === '1080p' ? 1080 : config.resolution === '720p' ? 720 : 480;

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: width },
        height: { ideal: height },
        frameRate: { ideal: config.fps, max: config.fps },
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    this.localStream = stream;
    this.updateLocalTracks();
    return stream;
  }

  /**
   * Acquire screen capture with native 30 or 60 FPS
   */
  public async startScreenShare(fps: 30 | 60 = 60, captureAudio = true): Promise<MediaStream> {
    const displayMediaOptions: DisplayMediaStreamOptions = {
      video: {
        frameRate: { ideal: fps, max: fps },
        width: { ideal: 1920, max: 2560 },
        height: { ideal: 1080, max: 1440 },
        displaySurface: 'monitor',
      },
      audio: captureAudio ? {
        echoCancellation: true,
        noiseSuppression: false, // keep original audio fidelity for screen audio
      } : false,
    };

    const stream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
    this.screenStream = stream;
    this.updateLocalTracks();
    return stream;
  }

  public stopScreenShare() {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((t) => t.stop());
      this.screenStream = null;
      this.updateLocalTracks();
    }
  }

  public stopAllLocalMedia() {
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((t) => t.stop());
      this.screenStream = null;
    }
  }

  /**
   * Initiate a connection to an existing participant in room
   */
  public async createPeerConnection(remoteUser: UserInfo, isInitiator: boolean): Promise<RTCPeerConnection> {
    if (this.peers.has(remoteUser.id)) {
      return this.peers.get(remoteUser.id)!.pc;
    }

    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    });

    const peerItem: PeerItem = {
      peerId: remoteUser.id,
      user: remoteUser,
      pc,
      connectionState: pc.connectionState,
      metrics: {
        rttMs: 0,
        currentFps: 30,
        packetsLost: 0,
        bitrateKbps: 0,
      },
    };

    // Attach local media tracks
    this.addTracksToPC(pc);

    // Setup DataChannel
    if (isInitiator) {
      const dc = pc.createDataChannel('glass-data', { ordered: true });
      this.setupDataChannel(dc, remoteUser);
      peerItem.dataChannel = dc;
    } else {
      pc.ondatachannel = (e) => {
        peerItem.dataChannel = e.channel;
        this.setupDataChannel(e.channel, remoteUser);
      };
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.sendSignal(remoteUser.id, {
          type: 'candidate',
          candidate: e.candidate,
        });
      }
    };

    pc.ontrack = (e) => {
      if (!peerItem.stream) {
        peerItem.stream = new MediaStream();
      }
      e.streams[0]?.getTracks().forEach((track) => {
        if (!peerItem.stream!.getTracks().some((t) => t.id === track.id)) {
          peerItem.stream!.addTrack(track);
        }
      });
      this.notifyPeers();
    };

    pc.onconnectionstatechange = () => {
      peerItem.connectionState = pc.connectionState;
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        // Will be cleaned up if leaves
      }
      this.notifyPeers();
    };

    this.peers.set(remoteUser.id, peerItem);
    this.notifyPeers();

    if (isInitiator) {
      try {
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });
        await pc.setLocalDescription(offer);
        this.sendSignal(remoteUser.id, {
          type: 'offer',
          sdp: offer,
        });
      } catch (err) {
        console.error('Error creating offer for peer:', remoteUser.id, err);
      }
    }

    return pc;
  }

  /**
   * Handle incoming WebRTC signaling data
   */
  public async handleSignal(fromUser: UserInfo, signalData: any) {
    let peerItem = this.peers.get(fromUser.id);
    if (!peerItem) {
      await this.createPeerConnection(fromUser, false);
      peerItem = this.peers.get(fromUser.id);
    }

    if (!peerItem) return;
    const pc = peerItem.pc;

    if (signalData.type === 'offer') {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.sendSignal(fromUser.id, {
          type: 'answer',
          sdp: answer,
        });
      } catch (err) {
        console.error('Error processing offer:', err);
      }
    } else if (signalData.type === 'answer') {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
      } catch (err) {
        console.error('Error processing answer:', err);
      }
    } else if (signalData.type === 'candidate' && signalData.candidate) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(signalData.candidate));
      } catch (err) {
        console.error('Error adding ICE candidate:', err);
      }
    }
  }

  private setupDataChannel(dc: RTCDataChannel, remoteUser: UserInfo) {
    dc.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.type === 'file-chunk' || parsed.type === 'file-meta') {
          this.onFileChunk(remoteUser, parsed);
        } else {
          this.onDataMessage(remoteUser, parsed);
        }
      } catch (e) {
        // Raw string or non-JSON
      }
    };
  }

  public broadcastDataMessage(data: any) {
    const payload = JSON.stringify(data);
    for (const peer of this.peers.values()) {
      if (peer.dataChannel && peer.dataChannel.readyState === 'open') {
        peer.dataChannel.send(payload);
      }
    }
  }

  public sendDataToPeer(peerId: string, data: any) {
    const peer = this.peers.get(peerId);
    if (peer && peer.dataChannel && peer.dataChannel.readyState === 'open') {
      peer.dataChannel.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

  private addTracksToPC(pc: RTCPeerConnection) {
    const activeStream = this.screenStream || this.localStream;
    if (activeStream) {
      activeStream.getTracks().forEach((track) => {
        pc.addTrack(track, activeStream);
      });
    }
  }

  private updateLocalTracks() {
    const activeStream = this.screenStream || this.localStream;
    if (!activeStream) return;

    for (const peer of this.peers.values()) {
      const senders = peer.pc.getSenders();
      const videoTrack = activeStream.getVideoTracks()[0] || null;
      const audioTrack = (this.localStream?.getAudioTracks()[0]) || (activeStream.getAudioTracks()[0]) || null;

      senders.forEach((sender) => {
        if (sender.track?.kind === 'video' && videoTrack) {
          sender.replaceTrack(videoTrack);
        } else if (sender.track?.kind === 'audio' && audioTrack) {
          sender.replaceTrack(audioTrack);
        }
      });
    }
  }

  public removePeer(peerId: string) {
    const peer = this.peers.get(peerId);
    if (peer) {
      if (peer.dataChannel) {
        peer.dataChannel.close();
      }
      peer.pc.close();
      this.peers.delete(peerId);
      this.notifyPeers();
    }
  }

  public closeAll() {
    this.stopAllLocalMedia();
    for (const peer of this.peers.values()) {
      if (peer.dataChannel) peer.dataChannel.close();
      peer.pc.close();
    }
    this.peers.clear();
    this.notifyPeers();
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
  }

  private notifyPeers() {
    this.onPeersChange(Array.from(this.peers.values()));
  }

  private startStatsPolling() {
    this.statsInterval = setInterval(async () => {
      for (const peer of this.peers.values()) {
        try {
          const stats = await peer.pc.getStats();
          stats.forEach((report) => {
            if (report.type === 'candidate-pair' && report.state === 'succeeded') {
              peer.metrics.rttMs = Math.round((report.currentRoundTripTime || 0) * 1000);
            }
            if (report.type === 'inbound-rtp' && report.kind === 'video') {
              if (report.framesPerSecond) {
                peer.metrics.currentFps = Math.round(report.framesPerSecond);
              }
              if (report.packetsLost) {
                peer.metrics.packetsLost = report.packetsLost;
              }
            }
          });
        } catch (e) {}
      }
      this.notifyPeers();
    }, 2000);
  }
}
