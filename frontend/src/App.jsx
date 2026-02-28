import React, { useState } from 'react'
import './index.css'
import SetupPage from './pages/SetupPage'
import InterviewPage from './pages/InterviewPage'
import FeedbackPage from './pages/FeedbackPage'

export default function App() {
  const [page, setPage] = useState('setup')         // 'setup' | 'interview' | 'feedback'
  const [sessionData, setSessionData] = useState(null)  // { session_id, question, question_index, ... }
  const [feedbackData, setFeedbackData] = useState(null)

  const handleInterviewStart = (data) => {
    setSessionData(data)
    setPage('interview')
  }

  const handleInterviewEnd = (feedback) => {
    setFeedbackData(feedback)
    setPage('feedback')
  }

  const handleRestart = () => {
    setSessionData(null)
    setFeedbackData(null)
    setPage('setup')
  }

  return (
    <>
      {page === 'setup' && (
        <SetupPage onStart={handleInterviewStart} />
      )}
      {page === 'interview' && (
        <InterviewPage
          initialData={sessionData}
          onEnd={handleInterviewEnd}
        />
      )}
      {page === 'feedback' && (
        <FeedbackPage
          feedback={feedbackData}
          onRestart={handleRestart}
        />
      )}
    </>
  )
}
