const createConsumer = (consumerTransport, pid, device, socket, kind, slot) => {
  return new Promise(async (resolve, reject) => {
    const consumerParams = await socket.emitWithAck("consumeMedia", {
      rtpCapabilities: device.rtpCapabilities,
      pid,
      kind,
    });
    if (consumerParams === "cannotConsume") {
      resolve();
    } else if (consumerParams === "consumeFailed") {
      resolve();
    } else {
      const consumer = await consumerTransport.consume(consumerParams);
      const { track } = consumer;
      await socket.emitWithAck("unpauseConsumer", { pid, kind });
      resolve(consumer);
    }
  });
};

export default createConsumer;
