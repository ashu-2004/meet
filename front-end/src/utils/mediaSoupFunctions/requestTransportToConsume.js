import createConsumer from "./createConsumer";
import createConsumerTransport from "./createConsumerTransport";

const requestTransportToConsume = (consumeData, socket, device, consumers, updateConsumers) => {

  consumeData.audioPidsToCreate.forEach(async (audioPid, i) => {
    const videoPid = consumeData.videoPidsToCreate[i];
    const consumerTransportParams = await socket.emitWithAck("requestTransport", {
      type: "consumer",
      audioPid,
    });

    const consumerTransport = createConsumerTransport(consumerTransportParams, device, socket, audioPid);

    const [audioConsumer, videoConsumer] = await Promise.all([
      createConsumer(consumerTransport, audioPid, device, socket, "audio", i),
      createConsumer(consumerTransport, videoPid, device, socket, "video", i),
    ]);
    const combinedStream = new MediaStream([audioConsumer?.track, videoConsumer?.track]);

    const socketId = consumerTransportParams.producerSocketId;

    const userRole =
      consumerTransportParams.producerRole ||
      (consumeData.associatedUserRoles ? consumeData.associatedUserRoles[i] : "candidate");

    updateConsumers(audioPid, {
      combinedStream,
      userName: consumeData.associatedUserNames[i],
      socketId, 
      userRole,
      consumerTransport,
      audioConsumer,
      videoConsumer,
    });
  });
};

export default requestTransportToConsume;
