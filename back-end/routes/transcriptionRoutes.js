const express = require("express");
const {
  postTranscription,
  getTranscriptions,
  getCandidateTranscriptions,
  getInterviewerTranscriptions,
  clearTranscriptions
} = require("../controller/transcription");

const router = express.Router();

router.post("/transcription", postTranscription);
router.get("/transcriptions", getTranscriptions);
router.get("/transcriptions/candidate", getCandidateTranscriptions);
router.get("/transcriptions/interviewer", getInterviewerTranscriptions);
router.post("/transcriptions/clear", clearTranscriptions);

module.exports = router;
