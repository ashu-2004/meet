const fs = require("fs");
const path = require("path");

const transcriptions = {
  candidate: [],
  interviewer: [],
};

exports.postTranscription = async (req, res) => {
  try {
    const { sender, transcript, timestamp } = req.body;
    const formattedTimestamp = timestamp || new Date().toISOString();

    if (!transcript) {
      return res.status(400).json({ error: "Transcript is required" });
    }

    // console.log(
    //   `[${formattedTimestamp}] ${
    //     sender || "Unknown"
    //   } Transcription: ${transcript}`
    // );

    if (sender === "candidate") {
      transcriptions.candidate.push({
        transcript,
        timestamp: formattedTimestamp,
      });
      fs.appendFileSync(
        path.join(__dirname, "candidate-transcriptions.txt"),
        `[${formattedTimestamp}] ${transcript}\n`,
        { encoding: "utf8" }
      );
    } else if (sender === "interviewer") {
      transcriptions.interviewer.push({
        transcript,
        timestamp: formattedTimestamp,
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Transcription received",
    });
  } catch (error) {
    console.error("Error processing transcription:", error);
    return res.status(500).json({
      status: "error",
      message: "Error processing transcription",
      error: error.message,
    });
  }
};

exports.getTranscriptions = (req, res) => {
  return res.status(200).json(transcriptions);
};

exports.getCandidateTranscriptions = (req, res) => {
  return res.status(200).json(transcriptions.candidate);
};

exports.getInterviewerTranscriptions = (req, res) => {
  return res.status(200).json(transcriptions.interviewer);
};

exports.clearTranscriptions = (req, res) => {
  transcriptions.candidate = [];
  transcriptions.interviewer = [];
  return res.status(200).json({
    status: "success",
    message: "Transcriptions cleared",
  });
};

module.exports = {
  postTranscription: exports.postTranscription,
  getTranscriptions: exports.getTranscriptions,
  getCandidateTranscriptions: exports.getCandidateTranscriptions,
  getInterviewerTranscriptions: exports.getInterviewerTranscriptions,
  clearTranscriptions: exports.clearTranscriptions,
  transcriptions,
};
