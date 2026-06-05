import React, { useState, useEffect, useRef } from "react";
import { collection, doc, getDoc, getDocs, addDoc } from "firebase/firestore";
import { auth, db } from "../config/firebase";
import SubmissionModal from "./SubmissionModal";
import {
  Timer,
  BookMarked,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Trophy,
  Gauge,
  LogOut,
} from "lucide-react";

export default function StudentDashboard({ user }) {
  const [college, setCollege] = useState("");
  const [cgpa, setCgpa] = useState("");
  const [onboarded, setOnboarded] = useState(false);

  const [config, setConfig] = useState({ totalTimeAllowed: 30 });
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [completed, setCompleted] = useState(false);

  // UI rendering state hooks
  const [answers, setAnswers] = useState({});
  const [confidence, setConfidence] = useState({});
  const [reviews, setReviews] = useState({});
  const [visited, setVisited] = useState({});
  const [timeLeft, setTimeLeft] = useState(1800);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);

  // REAL-TIME ENGINE CORRECTIONS: Persistent references tracking metrics outside of closures
  const activeSecsRef = useRef(0);
  const timeSpentMapRef = useRef({});
  const optionChangesRef = useRef({});
  const reviewTimesMapRef = useRef({});
  const confidenceRef = useRef({});

  const countdownTimer = useRef(null);
  const focusTimer = useRef(null);

  useEffect(() => {
    initializeExamConfig();
  }, []);

  useEffect(() => {
    if (onboarded && questions.length > 0 && !completed) {
      countdownTimer.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(countdownTimer.current);
            forceAutoSubmission();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      focusTimer.current = setInterval(() => {
        activeSecsRef.current += 1;
      }, 1000);
    }
    return () => {
      clearInterval(countdownTimer.current);
      clearInterval(focusTimer.current);
    };
  }, [onboarded, currentIdx, questions, completed]);

  const initializeExamConfig = async () => {
    const configSnap = await getDoc(doc(db, "settings", "config"));
    if (configSnap.exists()) {
      setConfig(configSnap.data());
      setTimeLeft(configSnap.data().totalTimeAllowed * 60);
    }
    const qSnap = await getDocs(collection(db, "questions"));
    const items = qSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    setQuestions(items);
    if (items.length > 0) setVisited({ [items[0].id]: true });
  };

  const syncActiveTelemetry = () => {
    if (questions.length === 0) return;
    const currentId = questions[currentIdx].id;

    const targetTime = activeSecsRef.current;
    if (targetTime > 0) {
      activeSecsRef.current = 0;
      timeSpentMapRef.current[currentId] =
        (timeSpentMapRef.current[currentId] || 0) + targetTime;
    }
  };

  const handleNavigate = (nextIdx) => {
    if (nextIdx < 0 || nextIdx >= questions.length) return;
    syncActiveTelemetry();
    const nextId = questions[nextIdx].id;
    setVisited((prev) => ({ ...prev, [nextId]: true }));
    setCurrentIdx(nextIdx);
  };

  const selectOptionValue = (val) => {
    const currentId = questions[currentIdx].id;

    setAnswers((prevAnswers) => {
      const originalVal = prevAnswers[currentId];
      if (originalVal === val) return prevAnswers;

      if (originalVal !== undefined && originalVal !== "") {
        optionChangesRef.current[currentId] =
          (optionChangesRef.current[currentId] || 0) + 1;
      }

      return { ...prevAnswers, [currentId]: val };
    });
  };

  // CORRECTED: Hardened against structural updates by routing strict IDs
  const toggleReviewFlag = (questionId) => {
    if (!questionId) return;

    setReviews((prev) => ({ ...prev, [questionId]: !prev[questionId] }));
    reviewTimesMapRef.current[questionId] =
      (Number(reviewTimesMapRef.current[questionId]) || 0) + 1;
  };

  const recordConfidenceIndex = (rating) => {
    const currentId = questions[currentIdx].id;
    setConfidence((prev) => ({ ...prev, [currentId]: rating }));
    confidenceRef.current[currentId] = rating;
  };

  const getQuestionBadgeColor = (qId, idx) => {
    if (currentIdx === idx)
      return "bg-blue-50 border-blue-600 text-blue-700 font-bold ring-2 ring-blue-100 scale-105 shadow-sm";
    if (reviews[qId])
      return "bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100";
    if (answers[qId])
      return "bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100";
    if (visited[qId])
      return "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100";
    return "bg-white border-slate-200 text-slate-400 hover:bg-slate-50";
  };

  const formatTimerClock = (seconds) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const compileSubmissionPayload = (timeRemaining) => {
    syncActiveTelemetry();

    let correctCount = 0;
    const trackingMetrics = {};

    questions.forEach((q) => {
      const selected = answers[q.id] || "";
      const isCorrect = selected === q.correctAnswer;
      if (isCorrect) correctCount++;

      trackingMetrics[q.id] = {
        finalSelectedOption: String(selected),
        timeSpent: Number(timeSpentMapRef.current[q.id] || 0),
        optionChanges: Number(optionChangesRef.current[q.id] || 0),
        markedForReview: Boolean(reviews[q.id] || (reviewTimesMapRef.current[q.id] || 0) > 0),
        reviewClickCount: Number(reviewTimesMapRef.current[q.id] || 0),
        confidenceRating: Number(confidenceRef.current[q.id] || 0),
        isCorrect: Boolean(isCorrect),
      };
    });

    return {
      institution: college,
      studentCgpa: parseFloat(cgpa),
      studentUid: user.uid,
      correctPercentage:
        Math.round((correctCount / questions.length) * 10000) / 100,
      timeRemainingAtSubmission: Number(timeRemaining),
      timestamp: new Date().toISOString(),
      behavioralMetrics: trackingMetrics,
    };
  };

  const forceAutoSubmission = async () => {
    const payload = compileSubmissionPayload(0);
    try {
      await addDoc(collection(db, "quiz_attempts"), payload);
      setCompleted(true);
    } catch (err) {
      console.error("Auto submission error:", err);
    }
  };

  const handleOnboardSubmit = (e) => {
    e.preventDefault();
    if (college.trim() && cgpa) setOnboarded(true);
  };

  if (!onboarded) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-6 space-y-5 shadow-sm">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3 text-slate-800 text-sm font-bold tracking-wide uppercase">
            <GraduationCap className="w-5 h-5 text-blue-600" /> Candidate
            Verification Node
          </div>
          <form onSubmit={handleOnboardSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Full Institution Affiliation
              </label>
              <input
                type="text"
                required
                value={college}
                onChange={(e) => setCollege(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-lg p-2.5 text-xs text-slate-800 outline-none transition"
                placeholder="e.g., IIT Madras"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Current Cumulative CGPA (0.00 - 10.00)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="10"
                required
                value={cgpa}
                onChange={(e) => setCgpa(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-lg p-2.5 text-xs text-slate-800 outline-none transition"
                placeholder="e.g., 9.12"
              />
            </div>
            <div className="space-y-2 pt-2">
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg text-xs tracking-wider transition uppercase shadow-sm"
              >
                Initialize Secure Test Deployment
              </button>
              <button
                type="button"
                onClick={() => auth.signOut()}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-2.5 rounded-lg text-xs tracking-wider transition uppercase text-center border border-slate-200/40"
              >
                ◀ Cancel & Go Back
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 text-center">
        <div className="max-w-md bg-white border border-slate-200 rounded-xl p-8 space-y-4 shadow-sm">
          <Trophy className="w-12 h-12 text-emerald-500 mx-auto" />
          <h2 className="text-base font-bold text-slate-800 uppercase tracking-wide">
            Test Portfolio Locked & Saved
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed font-medium">
            Your response configuration vector and behavioral data maps have
            been written to the firestore cluster cloud core.
          </p>
          <div className="pt-2">
            <button
              onClick={() => auth.signOut()}
              className="bg-slate-800 hover:bg-slate-900 text-white text-xs px-5 py-2 rounded-lg transition font-bold uppercase tracking-wider shadow-sm"
            >
              Terminate Terminal Connection
            </button>
          </div>
        </div>
      </div>
    );
  }

  const activeQuestion = questions[currentIdx] || {
    text: "",
    options: [],
    id: "",
  };

  const missingConfidenceCount = questions.filter(
    (q) => answers[q.id] && !confidence[q.id]
  ).length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-600 font-sans text-xs flex flex-col md:flex-row">
      <div className="flex-1 p-6 space-y-6 flex flex-col justify-between">
        <div className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-xl p-5 relative shadow-sm">
            <div className="absolute top-3 right-4 text-[9px] text-slate-400 font-bold uppercase tracking-wider">
              Item Cluster {currentIdx + 1} of {questions.length}
            </div>
            <div className="flex gap-3 text-slate-800 text-sm font-medium leading-relaxed">
              <span className="text-blue-600 font-bold font-mono">
                {currentIdx + 1}.
              </span>
              <p className="whitespace-pre-wrap">{activeQuestion.text}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {activeQuestion.options.map((opt, i) => {
              const isSelected = answers[activeQuestion.id] === opt;
              return (
                <button
                  key={i}
                  onClick={() => selectOptionValue(opt)}
                  className={`w-full text-left font-medium border p-3.5 rounded-xl transition flex items-center gap-4 ${isSelected ? "bg-blue-50/50 border-blue-500 text-blue-700 font-semibold shadow-sm" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"}`}
                >
                  <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center text-xs font-mono transition-all ${isSelected ? "border-blue-600 bg-blue-600 text-white font-bold shadow-sm" : "border-slate-300 text-slate-400"}`}
                  >
                    {String.fromCharCode(65 + i)}
                  </div>
                  <span>{opt}</span>
                </button>
              );
            })}
          </div>

          {answers[activeQuestion.id] && (
            <div className={`bg-white border p-4 rounded-xl space-y-2.5 shadow-sm transition-all duration-300 ${!confidence[activeQuestion.id] ? "border-rose-300 bg-rose-50/10" : "border-slate-200"}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider text-slate-500">
                  <Gauge className="w-3.5 h-3.5 text-blue-600" /> Response
                  Confidence Index
                </div>
                {!confidence[activeQuestion.id] && (
                  <span className="text-[9px] text-rose-600 font-bold uppercase tracking-wide animate-pulse">
                    ⚠️ Mark your confidence
                  </span>
                )}
              </div>
              <div className="flex bg-slate-100 border border-slate-200/60 p-1 rounded-xl gap-1">
                {[1, 2, 3, 4, 5].map((num) => {
                  const isActive = confidence[activeQuestion.id] === num;
                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() => recordConfidenceIndex(num)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${isActive ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                    >
                      {num}
                    </button>
                  );
                })}
              </div>
              <div className="flex justify-between text-[9px] text-slate-400 font-bold uppercase tracking-wide px-1">
                <span>Complete Guess</span>
                <span>Absolute Certainty</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-slate-200 gap-3 mt-6">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleNavigate(currentIdx - 1)}
              disabled={currentIdx === 0}
              className="bg-white border border-slate-200 hover:border-slate-300 font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 text-xs text-slate-600 disabled:opacity-30 disabled:pointer-events-none transition shadow-sm"
            >
              <ChevronLeft className="w-4 h-4" /> Prev
            </button>
            <button
              type="button"
              onClick={() => handleNavigate(currentIdx + 1)}
              disabled={currentIdx === questions.length - 1}
              className="bg-white border border-slate-200 hover:border-slate-300 font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 text-xs text-slate-600 disabled:opacity-30 disabled:pointer-events-none transition shadow-sm"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => toggleReviewFlag(activeQuestion.id)}
            className={`font-bold px-4 py-1.5 border rounded-lg flex items-center gap-2 text-xs uppercase tracking-wider transition shadow-sm ${reviews[activeQuestion.id] ? "bg-amber-50 border-amber-400 text-amber-700" : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"}`}
          >
            <BookMarked className="w-3.5 h-3.5" />{" "}
            {reviews[activeQuestion.id] ? "Flagged" : "Mark for Review"}
          </button>
        </div>
      </div>

      <div className="w-full md:w-80 bg-white border-l border-slate-200 p-6 flex flex-col justify-between shadow-sm">
        <div className="space-y-6">
          <div className="bg-slate-50 border border-slate-200/60 rounded-xl py-3.5 px-4 relative">
            <div className="flex justify-between items-center">
              <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider block">
                Remaining Time Vector
              </span>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Disconnect terminal session?"))
                    auth.signOut();
                }}
                className="text-slate-300 hover:text-rose-600 transition"
                title="Force Log Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
            <div
              className={`text-xl font-bold font-mono tracking-wider flex items-center justify-center gap-1.5 mt-1 ${timeLeft < 300 ? "text-rose-600 animate-pulse" : "text-blue-600"}`}
            >
              <Timer className="w-4 h-4" /> {formatTimerClock(timeLeft)}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[9px] font-bold uppercase tracking-wide">
            <div className="bg-slate-50 border border-slate-200 p-2 rounded-lg text-center">
              <span className="text-slate-400 block">Attempted</span>
              <span className="text-xs text-emerald-600 font-bold mt-0.5 block">
                {questions.filter((q) => answers[q.id]).length}
              </span>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-2 rounded-lg text-center">
              <span className="text-slate-400 block">In Review</span>
              <span className="text-xs text-amber-600 font-bold mt-0.5 block">
                {questions.filter((q) => reviews[q.id]).length}
              </span>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-2 rounded-lg text-center">
              <span className="text-slate-400 block">Pending</span>
              <span className="text-xs text-rose-600 font-bold mt-0.5 block">
                {
                  questions.filter((q) => visited[q.id] && !answers[q.id])
                    .length
                }
              </span>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-2 rounded-lg text-center">
              <span className="text-slate-400 block">Unvisited</span>
              <span className="text-xs text-slate-400 font-bold mt-0.5 block">
                {questions.filter((q) => !visited[q.id]).length}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
              Assessment Grid Matrix
            </span>
            <div className="grid grid-cols-8 gap-1 p-2 bg-slate-50 border border-slate-100 rounded-xl">
              {questions.map((q, index) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => handleNavigate(index)}
                  className={`py-1.5 border rounded font-mono font-bold text-center text-[10px] transition flex items-center justify-center ${getQuestionBadgeColor(q.id, index)}`}
                >
                  {(index + 1).toString().padStart(2, "0")}
                </button>
              ))}
            </div>
          </div>
        </div>

        {missingConfidenceCount > 0 && (
          <div className="text-rose-600 font-bold text-center text-[10px] mt-4 uppercase animate-pulse bg-rose-50 border border-rose-200/50 p-2.5 rounded-xl">
            ⚠️ Mark confidence on all answered questions to submit ({missingConfidenceCount} remaining)
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            if (missingConfidenceCount > 0) {
              alert(`Please mark your confidence level for all answered questions first (${missingConfidenceCount} remaining).`);
              return;
            }
            syncActiveTelemetry();
            setIsSubmitModalOpen(true);
          }}
          className={`w-full font-bold py-2.5 rounded-xl text-xs tracking-wider transition uppercase mt-2 shadow-sm ${missingConfidenceCount > 0 ? "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300/40" : "bg-rose-600 hover:bg-rose-700 text-white"}`}
        >
          Final Exam Submission
        </button>
      </div>

      {isSubmitModalOpen && (
        <SubmissionModal
          questions={questions}
          answers={answers}
          reviews={reviews}
          // CORRECTED: Spreads the reference out as a clean, shallow object copy clone
          reviewTimesMap={{ ...reviewTimesMapRef.current }}
          visited={visited}
          onClose={() => setIsSubmitModalOpen(false)}
          onSubmitConfirm={async (word) => {
            if (word !== "SUBMIT") return;

            const payload = compileSubmissionPayload(timeLeft);

            try {
              await addDoc(collection(db, "quiz_attempts"), payload);
              setCompleted(true);
              setIsSubmitModalOpen(false);
            } catch (err) {
              alert("Data pipeline submission failure: " + err.message);
            }
          }}
        />
      )}
    </div>
  );
}
