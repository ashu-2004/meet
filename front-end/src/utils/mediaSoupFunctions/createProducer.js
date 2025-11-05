const createProducer = (localStream, producerTransport) => {
  return new Promise(async (resolve, reject) => {
    const videoTrack = localStream.getVideoTracks()[0]
    const audioTrack = localStream.getAudioTracks()[0]

    try {
      const videoProducer = await producerTransport.produce({ track: videoTrack })
      const audioProducer = await producerTransport.produce({ track: audioTrack })
      resolve({ audioProducer, videoProducer })
    } catch (err) {
      console.log(err, "error producing")
      reject(err)
    }
  })
}

export default createProducer

