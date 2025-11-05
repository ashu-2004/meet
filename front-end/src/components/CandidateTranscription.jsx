import { useEffect, useState, useRef } from "react";

const CandidateTranscription = ({ localStream }) => {
  const [isConnected, setIsConnected] = useState(false);

  const sendTranscription = async (transcript) => {
    try {
      const response = await fetch("/api/transcription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transcript: transcript,
          timestamp: new Date().toISOString(),
          sender: "candidate",
        }),
      });

      const data = await response.json();
      // console.log("[Candidate] Transcription sent to backend:", data);
      return true;
    } catch (error) {
      console.error("[Candidate] Error sending transcription:", error);
      return false;
    }
  };

  useEffect(() => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (!audioTrack) {
      console.error("No audio track found in stream");
      return;
    }

    const audioStream = new MediaStream([audioTrack]);

    const mimeType = MediaRecorder.isTypeSupported("audio/webm")
      ? "audio/webm"
      : MediaRecorder.isTypeSupported("audio/mp4")
      ? "audio/mp4"
      : null;

    if (!mimeType) {
      console.error("No supported audio MIME type found");
      return;
    }

    const mediaRecorder = new MediaRecorder(audioStream, {
      mimeType,
      audioBitsPerSecond: 128000,
    });

    const deepgramSocket = new WebSocket("wss://api.deepgram.com/v1/listen", [
      "token",
      "1f3fc83e4559e5e5db749b92a75fbd0d66813d3e",
    ]);

    deepgramSocket.onopen = () => {
      setIsConnected(true);
      // console.log("[Candidate] Connected to Deepgram");

      mediaRecorder.addEventListener("dataavailable", async (event) => {
        if (event.data.size > 0 && deepgramSocket.readyState === 1) {
          deepgramSocket.send(event.data);
        }
      });

      try {
        mediaRecorder.start(1000);
        // console.log("[Candidate] MediaRecorder started successfully");
      } catch (error) {
        console.error("[Candidate] Error starting MediaRecorder:", error);
      }
    };

    deepgramSocket.onmessage = (message) => {
      try {
        const received = JSON.parse(message.data);
        if (received && received.channel && received.channel.alternatives && received.channel.alternatives.length > 0) {
          const newTranscript = received.channel.alternatives[0].transcript;

          if (newTranscript && received.is_final) {
            // console.log("[Candidate Transcript]:", newTranscript);

            sendTranscription(newTranscript);
          }
        } else {
          // console.log("[Candidate] Received unexpected Deepgram data format:", received);
        }
      } catch (error) {
        console.error("[Candidate] Error processing transcript:", error);
      }
    };

    deepgramSocket.onclose = () => {
      setIsConnected(false);
      // console.log("[Candidate] Disconnected from Deepgram");
    };

    deepgramSocket.onerror = (error) => {
      console.error("[Candidate] Deepgram WebSocket error:", error);
    };

    return () => {
      if (mediaRecorder.state !== "inactive") {
        try {
          mediaRecorder.stop();
        } catch (error) {
          console.error("[Candidate] Error stopping MediaRecorder:", error);
        }
      }
      if (deepgramSocket.readyState === 1) {
        deepgramSocket.close();
      }
    };
  }, [localStream]);

  return null;
};

export default CandidateTranscription;
