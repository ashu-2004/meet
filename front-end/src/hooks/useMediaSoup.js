"use client";

import { useState, useEffect, useCallback } from "react";
import { io } from "socket.io-client";
import { Device } from "mediasoup-client";
import getMic2 from "../utils/getMic2";
import createProducerTransport from "../utils/mediaSoupFunctions/createProducerTransport";
import createProducer from "../utils/mediaSoupFunctions/createProducer";
import requestTransportToConsume from "../utils/mediaSoupFunctions/requestTransportToConsume";

const useMediaSoup = () => {
  const [socket, setSocket] = useState(null);
  const [device, setDevice] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [producerTransport, setProducerTransport] = useState(null);
  const [videoProducer, setVideoProducer] = useState(null);
  const [audioProducer, setAudioProducer] = useState(null);
  const [consumers, setConsumers] = useState({});
  const [activeSpeakers, setActiveSpeakers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [userRole, setUserRole] = useState("candidate");
  const [isJoined, setIsJoined] = useState(false);
  const [isFeedEnabled, setIsFeedEnabled] = useState(false);
  const [isFeedSending, setIsFeedSending] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);

  useEffect(() => {
    const socketInstance = io("https://localhost:3004", { transports: ["websocket"] });
    socketInstance.on("connect", () => {
      console.log("Connected to socket server");
    });
    setSocket(socketInstance);
    return () => {
      socketInstance.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handleActiveSpeakers = (newListOfActives) => {
      // console.log("Active speakers updated:", newListOfActives);
      setActiveSpeakers(newListOfActives);
    };
    socket.on("updateActiveSpeakers", handleActiveSpeakers);
    return () => {
      socket.off("updateActiveSpeakers", handleActiveSpeakers);
    };
  }, [socket, audioProducer]);

  useEffect(() => {
    if (!socket) return;
    const handleUserLeft = (userInfo) => {
      // console.log("User left:", userInfo);
      setConsumers((prevConsumers) => {
        const newConsumers = { ...prevConsumers };
        Object.keys(newConsumers).forEach((audioPid) => {
          if (newConsumers[audioPid].socketId === userInfo.socketId) {
            if (newConsumers[audioPid].transport) newConsumers[audioPid].transport.close();
            if (newConsumers[audioPid].audioConsumer) newConsumers[audioPid].audioConsumer.close();
            if (newConsumers[audioPid].videoConsumer) newConsumers[audioPid].videoConsumer.close();
            delete newConsumers[audioPid];
          }
        });
        return newConsumers;
      });
      const notificationId = Date.now();
      const newNotification = {
        id: notificationId,
        type: "userLeft",
        message: `${userInfo.userName} has left the meeting`,
        timestamp: new Date(),
      };
      setNotifications((prev) => [...prev, newNotification]);
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      }, 5000);
    };
    socket.on("userLeft", handleUserLeft);
    return () => {
      socket.off("userLeft", handleUserLeft);
    };
  }, [socket]);

  useEffect(() => {
    if (!socket || !device) return;
    const handleNewProducers = (consumeData) => {
      // console.log("New producers to consume:", consumeData);
      const updateConsumers = (audioPid, consumerData) => {
        setConsumers((prev) => ({
          ...prev,
          [audioPid]: consumerData,
        }));
      };
      requestTransportToConsume(consumeData, socket, device, consumers, updateConsumers);
    };
    socket.on("newProducersToConsume", handleNewProducers);
    return () => {
      socket.off("newProducersToConsume", handleNewProducers);
    };
  }, [socket, device, consumers]);

  const joinRoom = useCallback(
    async (roomName, userName, mediaOptions = null) => {
      if (!socket) return;
      try {
        if (mediaOptions && mediaOptions.localStream) {
          setLocalStream(mediaOptions.localStream);
          setIsFeedEnabled(true);
          if (!mediaOptions.isMicEnabled) setIsAudioMuted(true);
          if (!mediaOptions.isCameraEnabled) setIsCameraEnabled(false);
          if (mediaOptions.userRole) setUserRole(mediaOptions.userRole);
        }
        const joinRoomResp = await socket.emitWithAck("joinRoom", {
          userName,
          roomName,
          userRole: mediaOptions?.userRole || "candidate",
        });
        // console.log("Join room response:", joinRoomResp);
        const newDevice = new Device();
        await newDevice.load({
          routerRtpCapabilities: joinRoomResp.routerRtpCapabilities,
        });
        setDevice(newDevice);
        const updateConsumers = (audioPid, consumerData) => {
          setConsumers((prev) => ({
            ...prev,
            [audioPid]: consumerData,
          }));
        };
        requestTransportToConsume(joinRoomResp, socket, newDevice, {}, updateConsumers);
        setIsJoined(true);
        if (mediaOptions && mediaOptions.localStream) {
          setTimeout(async () => {
            try {
              const transport = await createProducerTransport(socket, newDevice);
              setProducerTransport(transport);
              const producers = await createProducer(mediaOptions.localStream, transport);
              setAudioProducer(producers.audioProducer);
              setVideoProducer(producers.videoProducer);
              setIsFeedSending(true);
              if (!mediaOptions.isMicEnabled && producers.audioProducer) {
                producers.audioProducer.pause();
                socket.emit("audioChange", "mute");
              }
              if (!mediaOptions.isCameraEnabled && producers.videoProducer) {
                producers.videoProducer.pause();
                socket.emit("videoChange", "pause");
              }
              const notificationId = Date.now();
              const newNotification = {
                id: notificationId,
                type: "userJoined",
                message: "You have joined the meeting",
                timestamp: new Date(),
              };
              setNotifications((prev) => [...prev, newNotification]);
              setTimeout(() => {
                setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
              }, 5000);
            } catch (error) {
              console.error("Error auto-starting feed:", error);
            }
          }, 1000);
        }
      } catch (error) {
        console.error("Error joining room:", error);
      }
    },
    [socket]
  );

  const enableFeed = useCallback(async () => {
    try {
      if (!localStream) {
        const mic2Id = await getMic2();
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: { deviceId: { exact: mic2Id } },
        });
        setLocalStream(stream);
      }
      setIsFeedEnabled(true);
    } catch (error) {
      console.error("Error enabling feed:", error);
    }
  }, [localStream]);

  const sendFeed = useCallback(async () => {
    if (!socket || !device || !localStream) return;
    try {
      const transport = await createProducerTransport(socket, device);
      setProducerTransport(transport);
      const producers = await createProducer(localStream, transport);
      setAudioProducer(producers.audioProducer);
      setVideoProducer(producers.videoProducer);
      setIsFeedSending(true);
    } catch (error) {
      console.error("Error sending feed:", error);
    }
  }, [socket, device, localStream]);

  const muteAudio = useCallback(() => {
    if (!audioProducer) return;
    if (audioProducer.paused) {
      audioProducer.resume();
      socket.emit("audioChange", "unmute");
      setIsAudioMuted(false);
    } else {
      audioProducer.pause();
      socket.emit("audioChange", "mute");
      setIsAudioMuted(true);
    }
  }, [audioProducer, socket]);

  const toggleCamera = useCallback(() => {
    if (!videoProducer || !localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (!videoTrack) return;
    if (isCameraEnabled) {
      videoProducer.pause();
      videoTrack.enabled = false;
      if (socket) socket.emit("videoChange", "pause");
      setIsCameraEnabled(false);
    } else {
      videoProducer.resume();
      videoTrack.enabled = true;
      if (socket) socket.emit("videoChange", "resume");
      setIsCameraEnabled(true);
    }
  }, [videoProducer, localStream, isCameraEnabled, socket]);

  const endCall = useCallback(() => {
    if (!socket) return;
    try {
      if (audioProducer) audioProducer.close();
      if (videoProducer) videoProducer.close();
      if (producerTransport) producerTransport.close();
      Object.values(consumers).forEach((consumer) => {
        if (consumer.transport) consumer.transport.close();
        if (consumer.audioConsumer) consumer.audioConsumer.close();
        if (consumer.videoConsumer) consumer.videoConsumer.close();
      });
      if (localStream) {
        localStream.getTracks().forEach((track) => {
          track.stop();
        });
      }
      socket.emit("leaveRoom");
      setProducerTransport(null);
      setVideoProducer(null);
      setAudioProducer(null);
      setConsumers({});
      setActiveSpeakers([]);
      setLocalStream(null);
      setIsFeedSending(false);
      setIsFeedEnabled(false);
      setIsAudioMuted(false);
      setIsCameraEnabled(true);
      setIsJoined(false);
      setUserRole("candidate");
      // console.log("Call ended successfully");
    } catch (error) {
      console.error("Error ending call:", error);
    }
  }, [socket, producerTransport, videoProducer, audioProducer, consumers, localStream]);

  const clearNotification = useCallback((notificationId) => {
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
  }, []);

  return {
    joinRoom,
    enableFeed,
    sendFeed,
    muteAudio,
    toggleCamera,
    endCall,
    clearNotification,
    isJoined,
    isFeedEnabled,
    isFeedSending,
    isAudioMuted,
    isCameraEnabled,
    localStream,
    consumers,
    activeSpeakers,
    notifications,
    userRole,
  };
};

export default useMediaSoup;
