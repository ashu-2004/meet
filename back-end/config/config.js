const config = {
  port: 3004,
  workerSettings: {
    rtcMinPort: 40000,
    rtcMaxPort: 41000,
    logLevel: "warn",
    logTags: ["info", "ice", "dtls", "rtp", "srtp", "rtcp"],
  },
  routerMediaCodecs: [
    {
      kind: "audio",
      mimeType: "audio/opus",
      clockRate: 48000,
      channels: 2,
    },
    {
      kind: "video",
      mimeType: "video/H264",
      clockRate: 90000,
      parameters: {
        "packetization-mode": 1,
        "profile-level-id": "42e01f",
        "level-asymmetry-allowed": 1,
      },
    },
    {
      kind: "video",
      mimeType: "video/VP8",
      clockRate: 90000,
      parameters: {},
    },
  ],
  //Local On Single Machine

  webRtcTransport: {
    listenIps: [{ ip: "0.0.0.0", announcedIp: "127.0.0.1" }],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    initialAvailableOutgoingBitrate: 1000000,
  },
  //For LAN or Public Server*/

  // webRtcTransport: {
  //   listenIps: [
  //     { ip: "0.0.0.0", announcedIp: "192.168.1.5" }, // your server's LAN IP
  //   ],
  //   enableUdp: true,
  //   enableTcp: true,
  //   preferUdp: true,
  //   initialAvailableOutgoingBitrate: 1000000,
  // },
};

module.exports = config;
