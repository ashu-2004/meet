const mediasoup = require("mediasoup");
const createWorkers = require("../utilities/createWorkers");
const getWorker = require("../utilities/getWorker");
const updateActiveSpeakers = require("../utilities/updateActiveSpeakers");
const Client = require("../classes/Client");
const Room = require("../classes/Room");

let workers = null;
const rooms = [];

module.exports = function (io) {
  const initMediaSoup = async () => {
    workers = await createWorkers();
  };

  initMediaSoup();

  io.on("connect", (socket) => {
    let client;
    const handshake = socket.handshake;
    socket.on(
      "joinRoom",
      async ({ userName, roomName, userRole = "candidate" }, ackCb) => {
        let newRoom = false;
        client = new Client(userName, socket, userRole);
        let requestedRoom = rooms.find((room) => room.roomName === roomName);
        if (!requestedRoom) {
          newRoom = true;
          const workerToUse = await getWorker(workers);
          requestedRoom = new Room(roomName, workerToUse);
          await requestedRoom.createRouter(io);
          rooms.push(requestedRoom);
        }
        client.room = requestedRoom;
        client.room.addClient(client);
        socket.join(client.room.roomName);

        const audioPidsToCreate = client.room.activeSpeakerList.slice(0, 5);
        const videoPidsToCreate = audioPidsToCreate.map((aid) => {
          const producingClient = client.room.clients.find(
            (c) => c?.producer?.audio?.id === aid
          );
          return producingClient?.producer?.video?.id;
        });
        const associatedUserNames = audioPidsToCreate.map((aid) => {
          const producingClient = client.room.clients.find(
            (c) => c?.producer?.audio?.id === aid
          );
          return producingClient?.userName;
        });
        const associatedUserRoles = audioPidsToCreate.map((aid) => {
          const producingClient = client.room.clients.find(
            (c) => c?.producer?.audio?.id === aid
          );
          return producingClient?.userRole || "candidate";
        });

        ackCb({
          routerRtpCapabilities: client.room.router.rtpCapabilities,
          newRoom,
          audioPidsToCreate,
          videoPidsToCreate,
          associatedUserNames,
          associatedUserRoles,
        });
      }
    );
    socket.on("requestTransport", async ({ type, audioPid }, ackCb) => {
      let clientTransportParams;
      if (type === "producer") {
        clientTransportParams = await client.addTransport(type);
      } else if (type === "consumer") {
        const producingClient = client.room.clients.find(
          (c) => c?.producer?.audio?.id === audioPid
        );
        const videoPid = producingClient?.producer?.video?.id;
        clientTransportParams = await client.addTransport(
          type,
          audioPid,
          videoPid
        );
        if (producingClient) {
          clientTransportParams.producerSocketId = producingClient.socket.id;
          clientTransportParams.producerRole =
            producingClient.userRole || "candidate";
        }
      }
      ackCb(clientTransportParams);
    });
    socket.on(
      "connectTransport",
      async ({ dtlsParameters, type, audioPid }, ackCb) => {
        if (type === "producer") {
          try {
            await client.upstreamTransport.connect({ dtlsParameters });
            ackCb("success");
          } catch (error) {
            console.log(error);
            ackCb("error");
          }
        } else if (type === "consumer") {
          try {
            const downstreamTransport = client.downstreamTransports.find(
              (t) => {
                return t.associatedAudioPid === audioPid;
              }
            );
            downstreamTransport.transport.connect({ dtlsParameters });
            ackCb("success");
          } catch (error) {
            console.log(error);
            ackCb("error");
          }
        }
      }
    );
    socket.on("unpauseConsumer", async ({ pid, kind }, ackCb) => {
      const consumerToResume = client.downstreamTransports.find(
        (t) => t?.[kind]?.producerId === pid
      );
      await consumerToResume[kind].resume();
      ackCb();
    });

    socket.on("startProducing", async ({ kind, rtpParameters }, ackCb) => {
      try {
        const newProducer = await client.upstreamTransport.produce({
          kind,
          rtpParameters,
        });
        client.addProducer(kind, newProducer);
        if (kind === "audio") {
          client.room.activeSpeakerList.push(newProducer.id);
        }
        ackCb(newProducer.id);
      } catch (err) {
        console.log(err);
        ackCb(err);
      }
      const newTransportsByPeer = updateActiveSpeakers(client.room, io);
      for (const [socketId, audioPidsToCreate] of Object.entries(
        newTransportsByPeer
      )) {
        const videoPidsToCreate = audioPidsToCreate.map((aPid) => {
          const producerClient = client.room.clients.find(
            (c) => c?.producer?.audio?.id === aPid
          );
          return producerClient?.producer?.video?.id;
        });
        const associatedUserNames = audioPidsToCreate.map((aPid) => {
          const producerClient = client.room.clients.find(
            (c) => c?.producer?.audio?.id === aPid
          );
          return producerClient?.userName;
        });
        const associatedUserRoles = audioPidsToCreate.map((aPid) => {
          const producerClient = client.room.clients.find(
            (c) => c?.producer?.audio?.id === aPid
          );
          return producerClient?.userRole || "candidate";
        });
        io.to(socketId).emit("newProducersToConsume", {
          routerRtpCapabilities: client.room.router.rtpCapabilities,
          audioPidsToCreate,
          videoPidsToCreate,
          associatedUserNames,
          associatedUserRoles,
          activeSpeakerList: client.room.activeSpeakerList.slice(0, 5),
        });
      }
    });
    socket.on("audioChange", (typeOfChange) => {
      if (typeOfChange === "mute") {
        client?.producer?.audio?.pause();
      } else {
        client?.producer?.audio?.resume();
      }
    });
    socket.on("videoChange", (typeOfChange) => {
      if (typeOfChange === "pause") {
        client?.producer?.video?.pause();
      } else if (typeOfChange === "resume") {
        client?.producer?.video?.resume();
      }
    });
    socket.on("consumeMedia", async ({ rtpCapabilities, pid, kind }, ackCb) => {
      try {
        if (
          !client.room.router.canConsume({ producerId: pid, rtpCapabilities })
        ) {
          ackCb("cannotConsume");
        } else {
          const downstreamTransport = client.downstreamTransports.find((t) => {
            if (kind === "audio") {
              return t.associatedAudioPid === pid;
            } else if (kind === "video") {
              return t.associatedVideoPid === pid;
            }
          });
          const newConsumer = await downstreamTransport.transport.consume({
            producerId: pid,
            rtpCapabilities,
            paused: true,
          });
          client.addConsumer(kind, newConsumer, downstreamTransport);
          const clientParams = {
            producerId: pid,
            id: newConsumer.id,
            kind: newConsumer.kind,
            rtpParameters: newConsumer.rtpParameters,
          };
          ackCb(clientParams);
        }
      } catch (err) {
        console.log(err);
        ackCb("consumeFailed");
      }
    });
    socket.on("unpauseConsumer", async ({ pid, kind }, ackCb) => {
      const consumerToResume = client.downstreamTransports.find((t) => {
        return t?.[kind].producerId === pid;
      });
      await consumerToResume[kind].resume();
      ackCb();
    });
    socket.on("leaveRoom", () => {
      if (client && client.room) {
        const userInfo = {
          userName: client.userName,
          socketId: socket.id,
          userRole: client.userRole,
        };
        if (client.producer && client.producer.audio) {
          const audioId = client.producer.audio.id;
          const index = client.room.activeSpeakerList.indexOf(audioId);
          if (index > -1) {
            client.room.activeSpeakerList.splice(index, 1);
          }
        }
        const roomIndex = client.room.clients.findIndex(
          (c) => c.socket.id === socket.id
        );
        if (roomIndex > -1) {
          client.room.clients.splice(roomIndex, 1);
        }
        socket.to(client.room.roomName).emit("userLeft", userInfo);
        // console.log(
        //   `User ${userInfo.userName} (${userInfo.userRole}) left room ${client.room.roomName}`
        // );
      }
    });
    socket.on("disconnect", () => {
      if (client && client.room) {
        const userInfo = {
          userName: client.userName,
          socketId: socket.id,
          userRole: client.userRole,
        };
        if (client.producer && client.producer.audio) {
          const audioId = client.producer.audio.id;
          const index = client.room.activeSpeakerList.indexOf(audioId);
          if (index > -1) {
            client.room.activeSpeakerList.splice(index, 1);
          }
        }
        const roomIndex = client.room.clients.findIndex(
          (c) => c.socket.id === socket.id
        );
        if (roomIndex > -1) {
          client.room.clients.splice(roomIndex, 1);
        }
        socket.to(client.room.roomName).emit("userLeft", userInfo);
        // console.log(
        //   `User ${userInfo.userName} (${userInfo.userRole}) disconnected from room ${client.room.roomName}`
        // );
      }
    });
  });
};
