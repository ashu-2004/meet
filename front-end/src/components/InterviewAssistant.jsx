import { useEffect, useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import axios from "axios";

const InterviewAssistant = ({ localStream }) => {
  const [transcript, setTranscript] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [previousAnalysis, setPreviousAnalysis] = useState("");
  const [nextQuestion, setNextQuestion] = useState("");
  const [expectedAnswer, setExpectedAnswer] = useState("");
  const [evaluationAnswer, setEvaluationAnswer] = useState("");
  const [candidateTranscript, setCandidateTranscript] = useState("");
  const transcriptContainerRef = useRef(null);
  const pollingIntervalRef = useRef(null);

  const sendTranscription = async (transcript) => {
    try {
      await axios.post("/api/transcription", {
        transcript,
        timestamp: new Date().toISOString(),
        sender: "interviewer",
      });
      return true;
    } catch (error) {
      console.error("Error sending transcription:", error);
      return false;
    }
  };

  const fetchTranscriptions = async () => {
    try {
      const response = await axios.get("/api/transcriptions");
      const data = response.data;

      if (data.candidate && data.candidate.length > 0) {
        const allCandidateText = data.candidate
          .map((item) => item.transcript)
          .join(" ");
        setCandidateTranscript(allCandidateText);
      }
    } catch (error) {
      console.error("Error fetching transcriptions:", error);
    }
  };

  const resetInterview = async () => {
    try {
      setTranscript("");
      setCandidateTranscript("");
      setPreviousAnalysis("");
      setNextQuestion("");
      setExpectedAnswer("");
      setCurrentQuestion("");
      await axios.post("/api/transcriptions/clear");
      await axios.post("/api/reset");
    } catch (error) {
      console.error("Error resetting interview:", error);
    }
  };

  const analyzeResponse = async () => {
    const combinedTranscript = transcript + " " + candidateTranscript;
    if (!combinedTranscript.trim()) return;

    setIsAnalyzing(true);
    try {
      const response = await axios.post("/fastapi/analyze", {
        text: combinedTranscript,
      });

      const data = response.data;
      const analysisText = data.analysis || "";

      const analysisMatch = analysisText.match(
        /## Analysis[^\n]*\n([\s\S]*?)(?=^## |\Z)/im
      );
      const evaluationMatch = analysisText.match(
        /## Evaluation[^\n]*\n([\s\S]*?)(?=^## |\Z)/im
      );
      const expectedMatch = analysisText.match(
        /## Expected Answer[^\n]*\n([\s\S]*?)(?=^## |\Z)/im
      );
      const followUpMatch = analysisText.match(
        /## Next Question[^\n]*\n([\s\S]*?)(?=^## |\Z)/im
      );

      const analysisContent = analysisMatch ? analysisMatch[1].trim() : "";
      const evaluationContent = evaluationMatch
        ? evaluationMatch[1].trim()
        : "";
      const expectedContent = expectedMatch ? expectedMatch[1].trim() : "";
      const followUpContent = followUpMatch ? followUpMatch[1].trim() : "";

      setPreviousAnalysis(analysisContent);
      setExpectedAnswer(expectedContent);
      setEvaluationAnswer(evaluationContent);
      setNextQuestion(followUpContent);

      if (followUpContent) {
        const questions = followUpContent
          .split("\n")
          .map((line) => line.replace(/^[-*#]+\s*/, "").trim())
          .filter((line) => line.length > 0);
        if (questions.length > 0) setCurrentQuestion(questions[0]);
      }

      setTranscript("");
      setCandidateTranscript("");
      await axios.post("/api/transcriptions/clear");
    } catch {
      alert("Error connecting to the Python analysis backend.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    pollingIntervalRef.current = setInterval(fetchTranscriptions, 2000);
    fetchTranscriptions();
    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (!audioTrack) return;

    const audioStream = new MediaStream([audioTrack]);
    const mimeType = MediaRecorder.isTypeSupported("audio/webm")
      ? "audio/webm"
      : MediaRecorder.isTypeSupported("audio/mp4")
      ? "audio/mp4"
      : null;
    if (!mimeType) return;

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
      mediaRecorder.addEventListener("dataavailable", async (event) => {
        if (event.data.size > 0 && deepgramSocket.readyState === 1) {
          deepgramSocket.send(event.data);
        }
      });
      mediaRecorder.start(1000);
    };

    deepgramSocket.onmessage = (message) => {
      try {
        const received = JSON.parse(message.data);
        if (received?.channel?.alternatives?.length > 0 && received.is_final) {
          const newTranscript = received.channel.alternatives[0].transcript;
          if (newTranscript) {
            setTranscript((prev) => {
              const updatedTranscript = prev + " " + newTranscript;
              sendTranscription(newTranscript);
              return updatedTranscript;
            });
          }
        }
      } catch {}
    };

    deepgramSocket.onclose = () => setIsConnected(false);
    deepgramSocket.onerror = () => setIsConnected(false);

    return () => {
      if (mediaRecorder.state !== "inactive") {
        try {
          mediaRecorder.stop();
        } catch {}
      }
      if (deepgramSocket.readyState === 1) deepgramSocket.close();
    };
  }, [localStream]);

  useEffect(() => {
    if (transcriptContainerRef.current) {
      transcriptContainerRef.current.scrollTop =
        transcriptContainerRef.current.scrollHeight;
    }
  }, [transcript, candidateTranscript]);

  const combinedTranscriptDisplay = () => {
    if (!transcript && !candidateTranscript) return "No transcription yet...";
    let display = "";
    if (transcript) display += `Interviewer: ${transcript}\n\n`;
    if (candidateTranscript) display += `Candidate: ${candidateTranscript}`;
    return display;
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-800 border-l border-slate-700 overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-slate-700 flex-shrink-0">
        <h3 className="text-lg md:text-xl font-semibold text-white">
          Interview Assistant
        </h3>
        <div className="flex items-center space-x-2">
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected ? "bg-emerald-500" : "bg-red-500"
            }`}
          />
          <span className="text-xs md:text-sm text-slate-300">
            {isConnected ? "Connected" : "Disconnected"}
          </span>
        </div>
      </div>

      <div className="flex flex-col space-y-4 flex-1 overflow-y-auto p-3 sm:p-4">
        <div className="bg-slate-700/50 rounded-xl p-4 shadow-md flex flex-col flex-grow transition-all duration-300">
          <h4 className="text-sm md:text-base font-medium text-slate-300 mb-3 flex items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 mr-2 md:h-5 md:w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Follow-up Questions
          </h4>
          <div className="prose prose-invert prose-sm md:prose-base max-w-none bg-slate-800/60 p-3 md:p-4 rounded-lg overflow-auto">
            <ReactMarkdown>
              {nextQuestion ||
                "No question yet. Start the interview by analyzing."}
            </ReactMarkdown>
          </div>
        </div>

        <div className="bg-slate-700/50 rounded-xl p-4 shadow-md flex flex-col flex-grow transition-all duration-300">
          <h4 className="text-sm md:text-base font-medium text-slate-300 mb-3 flex items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 mr-2 md:h-5 md:w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
            Conversation Transcript
          </h4>
          <div
            ref={transcriptContainerRef}
            className="flex-1 overflow-y-auto text-sm md:text-base text-white whitespace-pre-wrap bg-slate-800/60 p-3 md:p-4 rounded-lg transition-all duration-300"
          >
            {combinedTranscriptDisplay()}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mt-2">
          <button
            onClick={resetInterview}
            className="flex-1 sm:w-1/3 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-all duration-200 shadow-md"
          >
            Reset
          </button>
          <button
            onClick={analyzeResponse}
            disabled={
              isAnalyzing || !(transcript.trim() || candidateTranscript.trim())
            }
            className={`flex-1 sm:w-2/3 px-4 py-2 ${
              isAnalyzing || !(transcript.trim() || candidateTranscript.trim())
                ? "bg-emerald-700/50 cursor-not-allowed"
                : "bg-emerald-600 hover:bg-emerald-700"
            } text-white rounded-lg font-medium transition-all duration-200 shadow-md`}
          >
            {isAnalyzing ? "Analyzing..." : "Analyze Response"}
          </button>
        </div>

        {(previousAnalysis || expectedAnswer || evaluationAnswer) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            {previousAnalysis && (
              <div className="bg-slate-700/50 rounded-xl p-4 shadow-md transition-all duration-300">
                <h4 className="text-sm md:text-base font-medium text-slate-300 mb-2">
                  Analysis
                </h4>
                <div className="prose prose-invert prose-sm md:prose-base max-w-none bg-slate-800/60 p-3 md:p-4 rounded-lg overflow-auto">
                  <ReactMarkdown>{previousAnalysis}</ReactMarkdown>
                </div>
              </div>
            )}

            {evaluationAnswer && (
              <div className="bg-slate-700/50 rounded-xl p-4 shadow-md transition-all duration-300">
                <h4 className="text-sm md:text-base font-medium text-slate-300 mb-2">
                  Evaluation
                </h4>
                <div className="prose prose-invert prose-sm md:prose-base max-w-none bg-slate-800/60 p-3 md:p-4 rounded-lg overflow-auto">
                  <ReactMarkdown>{evaluationAnswer}</ReactMarkdown>
                </div>
              </div>
            )}

            {expectedAnswer && (
              <div className="bg-slate-700/50 rounded-xl p-4 shadow-md transition-all duration-300 lg:col-span-2">
                <h4 className="text-sm md:text-base font-medium text-slate-300 mb-2">
                  Expected Answer
                </h4>
                <div className="prose prose-invert prose-sm md:prose-base max-w-none bg-slate-800/60 p-3 md:p-4 rounded-lg overflow-auto">
                  <ReactMarkdown>{expectedAnswer}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default InterviewAssistant;
