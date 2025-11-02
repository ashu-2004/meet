const config = {
  port: 3004,
  workerSettings: {
    //rtcMinPort and max are just arbitray ports for our traffic
    //useful for firewall or networking rules
    rtcMinPort: 40000,
    rtcMaxPort: 41000,
    //log levels you want to set
    logLevel: "warn",
    logTags: ["info", "ice", "dtls", "rtp", "srtp", "rtcp"],
  },
  // routerMediaCodecs: [
  //   {
  //     kind: "audio",
  //     mimeType: "audio/opus",
  //     clockRate: 48000,
  //     channels: 2,
  //   },
  //   {
  //     kind: "video",
  //     mimeType: "video/H264",
  //     clockRate: 90000,
  //     parameters: {
  //       "packetization-mode": 1,
  //       "profile-level-id": "42e01f",
  //       "level-asymmetry-allowed": 1,
  //     },
  //   },
  //   {
  //     kind: "video",
  //     mimeType: "video/VP8",
  //     clockRate: 90000,
  //     parameters: {},
  //   },
  // ],
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

  // webRtcTransport: {
  //   listenIps: [
  //     {
  //       ip: "0.0.0.0",
  //       announcedIp: "propanedioic-limicoline-janel.ngrok-free.dev", // 👈 your ngrok domain
  //     },
  //   ],
  //   enableUdp: true,
  //   enableTcp: true,
  //   preferUdp: true,
  //   initialAvailableOutgoingBitrate: 1000000,
  //   maxIncomingBitrate: 1500000,
  // },
  webRtcTransport: {
    listenIps: [
      { ip: "0.0.0.0", announcedIp: null }, // listen on all local interfaces
    ],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    initialAvailableOutgoingBitrate: 1000000,
  },
};

module.exports = config;
