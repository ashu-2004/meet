const createProducerTransport = (socket, device) =>
  new Promise(async (resolve, reject) => {
    const producerTransportParams = await socket.emitWithAck("requestTransport", { type: "producer" })
    const producerTransport = device.createSendTransport(producerTransportParams)

    producerTransport.on("connect", async ({ dtlsParameters }, callback, errback) => {
      const connectResp = await socket.emitWithAck("connectTransport", {
        dtlsParameters,
        type: "producer",
      })


      if (connectResp === "success") {
        callback()
      } else if (connectResp === "error") {
        errback()
      }
    })

    producerTransport.on("produce", async (parameters, callback, errback) => {
    
      const { kind, rtpParameters } = parameters
      const produceResp = await socket.emitWithAck("startProducing", { kind, rtpParameters })

      if (produceResp === "error") {
        errback()
      } else {
        callback({ id: produceResp })
      }
    })

    resolve(producerTransport)
  })

export default createProducerTransport

