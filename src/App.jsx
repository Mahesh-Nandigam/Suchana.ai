import React, { useState, useRef, useEffect } from 'react';
import { Mic, Send, ChevronRight, CheckCircle, ArrowRight, ShieldCheck, Building, Briefcase, Zap, Search, Fingerprint, X, AudioLines } from 'lucide-react';
import './index.css';

const SYSTEM_PROMPT = `You are a highly specialized legal AI assistant for the Government of India. 
Your ONLY job is to take a citizen's informal complaint and output a perfectly formatted JSON object representing a Right to Information (RTI) application.

Rules:
1. An RTI application legally requires essential details from the applicant to be valid: Applicant Full Name, Complete Address, Pin Code, Contact Number, and Specific details/location of the issue.
2. Analyze the user's input. If ANY of these critical details are missing, you MUST return a JSON object asking for them:
   {
     "status": "needs_info",
     "missing_questions": ["What is your full name?", "Please provide your complete address and pin code."]
   }
   Limit missing_questions to a maximum of 4 major questions.
3. If ALL details are present (or the user has provided enough context to proceed), draft the complete, legally sound RTI application under Section 6(1) of the RTI Act 2005. 
4. The draft must ask 3-4 highly specific, piercing questions demanding accountability, budget details, and action taken reports, and embed the user's name/address at the bottom.
5. In this case, you MUST return EXACTLY this JSON format:
   {
     "status": "draft_ready",
     "ministry": "Ministry of Housing and Urban Affairs (example)",
     "authority": "Public Information Officer (example)",
     "draft": "To,\\nThe PIO... \\n\\nSubject: RTI Application under RTI Act 2005... \\n\\n[WRITE THE ENTIRE, COMPLETE 400+ WORD LEGAL DRAFT HERE. DO NOT TRUNCATE.]"
   }

You MUST respond ONLY with a raw JSON object containing no markdown formatting, no backticks. Do not output anything outside the JSON.`;

export default function App() {
  const [step, setStep] = useState('landing');
  const [complaint, setComplaint] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [processingText, setProcessingText] = useState('');
  const [rtiData, setRtiData] = useState(null);
  const [error, setError] = useState('');
  const [missingQuestions, setMissingQuestions] = useState([]);
  const [additionalDetails, setAdditionalDetails] = useState('');
  const [recordingTime, setRecordingTime] = useState(0);
  
  const recognitionRef = useRef(null);
  const timerRef = useRef(null);
  const previousTextRef = useRef('');
  const textareaRef1 = useRef(null);
  const textareaRef2 = useRef(null);

  // Auto-scroll textareas
  useEffect(() => {
    if (textareaRef1.current) {
      textareaRef1.current.scrollTop = textareaRef1.current.scrollHeight;
    }
    if (textareaRef2.current) {
      textareaRef2.current.scrollTop = textareaRef2.current.scrollHeight;
    }
  }, [complaint, additionalDetails]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const stopRecording = (cancel = false) => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch(e) {}
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsListening(false);
    setRecordingTime(0);
    
    if (cancel) {
      if (step === 'input') setComplaint(previousTextRef.current);
      else setAdditionalDetails(previousTextRef.current);
    }
  };

  const handleMicClick = () => {
    if (isListening) {
      stopRecording(false);
      return;
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Your browser does not support voice dictation. Please type instead.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    
    recognition.lang = 'en-IN';
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onstart = () => {
      setIsListening(true);
      setRecordingTime(0);
      
      let currentText = step === 'input' ? complaint : additionalDetails;
      if (currentText && !currentText.endsWith(' ') && !currentText.endsWith('\n')) {
        currentText += ' ';
      }
      previousTextRef.current = currentText;

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 119) {
            stopRecording(false);
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    };

    recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      if (finalTranscript) {
        previousTextRef.current += finalTranscript + ' ';
      }
      
      const displayText = previousTextRef.current + interimTranscript;
      
      if (step === 'input') {
        setComplaint(displayText);
      } else {
        setAdditionalDetails(displayText);
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      stopRecording(false); // Stop safely without destroying the text on generic errors
    };

    recognition.onend = () => {
      stopRecording(false);
    };

    recognition.start();
  };

  const renderVoicePill = () => {
    if (!isListening) return null;
    
    const mins = Math.floor(recordingTime / 60);
    const secs = recordingTime % 60;
    const timeString = `${mins}:${secs.toString().padStart(2, '0')}`;

    return (
      <div className="recording-pill-overlay">
        <div className="pill-mic-icon" style={{ display: 'flex', alignItems: 'center', color: '#ef4444' }}>
          <Mic size={16} className="dynamic-mic" />
        </div>
        <span className="pill-text">Recording...</span>
        <span className="pill-timer">{timeString}</span>
        <button className="pill-stop-btn" onClick={() => stopRecording(false)} title="Stop & Keep">
          <div className="pill-stop-square"></div>
        </button>
        <button className="pill-close-btn" onClick={() => stopRecording(true)} title="Cancel">
          <X size={16} />
        </button>
      </div>
    );
  };

  const processWithGroq = async (text) => {
    const apiKey = import.meta.env.VITE_GROQ_API_KEY;
    if (!apiKey || apiKey === 'your_groq_api_key_here') {
      throw new Error("API Key is missing. Please add VITE_GROQ_API_KEY to your .env.local file.");
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'qwen/qwen3.6-27b',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: text }
        ],
        temperature: 0.2,
        max_tokens: 4096
      })
    });

    if (!response.ok) {
      let errorMsg = response.statusText;
      try {
        const errData = await response.json();
        if (errData.error && errData.error.message) {
          errorMsg = errData.error.message;
        }
      } catch (e) {
        // ignore JSON parse error
      }
      throw new Error(`API Error: ${errorMsg}`);
    }

    const data = await response.json();
    let content = data.choices[0].message.content || '';
    
    // Safely remove <think> blocks
    const thinkEnd = content.lastIndexOf('</think>');
    if (thinkEnd !== -1) {
      content = content.substring(thinkEnd + 8);
    } else if (content.includes('<think>')) {
      content = content.replace(/<think>[\s\S]*?(<\/think>|$)/gi, '');
    }
    
    // Clean up potential markdown wrappers
    content = content.replace(/```json/gi, '').replace(/```/gi, '').trim();
    
    // Find the first { and last } to extract just the JSON object
    const startIdx = content.indexOf('{');
    const endIdx = content.lastIndexOf('}');
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      content = content.substring(startIdx, endIdx + 1);
    } else {
      throw new Error("AI did not return a valid JSON format. Please try again.");
    }
    
    return JSON.parse(content);
  };

  const handleSubmit = async () => {
    if (isListening) {
      stopRecording(false);
    }
    if (!complaint) return;
    setStep('processing');
    setError('');
    
    const processingSteps = [
      "Analyzing natural language complaint...",
      "Connecting to Groq AI...",
      "Extracting key entities and jurisdiction...",
      "Drafting legal clauses under RTI Act 2005..."
    ];

    let i = 0;
    setProcessingText(processingSteps[0]);
    const interval = setInterval(() => {
      i++;
      if (i < processingSteps.length) {
        setProcessingText(processingSteps[i]);
      }
    }, 1500);

    try {
      const fullText = additionalDetails ? `${complaint}\n\nApplicant Details Provided: ${additionalDetails}` : complaint;
      const result = await processWithGroq(fullText);
      clearInterval(interval);
      
      if (result.status === 'needs_info') {
        setMissingQuestions(result.missing_questions);
        setStep('details');
      } else {
        setRtiData(result);
        setStep('review');
      }
    } catch (err) {
      clearInterval(interval);
      setError(err.message);
      setStep(additionalDetails ? 'details' : 'input');
    }
  };

  return (
    <>
      <div className="header-nav" onClick={() => setStep('landing')} style={{cursor: 'pointer'}}>
        <ShieldCheck className="text-accent" size={32} />
        <span style={{ fontSize: '1.5rem', fontWeight: '700', letterSpacing: '-0.5px' }}>Suchana.ai</span>
      </div>

      {step === 'landing' && (
        <div className="landing-container">
          <div className="hero-section">
            <h1 className="hero-title">Hold the Government Accountable.<br/><span className="text-gradient">In 30 Seconds.</span></h1>
            <p className="hero-subtitle">
              Powered by Groq AI. Tell us your problem, and we'll instantly draft, route, and file a legally binding Right to Information request.
            </p>
            <button className="btn-hero" onClick={() => setStep('input')}>
              File an RTI Now <ChevronRight size={24} />
            </button>
          </div>

          <div className="features-grid">
            <div className="feature-card glass-panel">
              <div className="feature-icon"><Zap size={24} /></div>
              <h3>Zero Legal Knowledge</h3>
              <p>Just vent about your issue in plain English. Our AI drafts the complex legal clauses automatically.</p>
            </div>
            <div className="feature-card glass-panel">
              <div className="feature-icon"><Search size={24} /></div>
              <h3>Smart Routing</h3>
              <p>Don't know which Ministry handles your issue? The AI instantly maps your complaint to the correct Public Authority.</p>
            </div>
            <div className="feature-card glass-panel">
              <div className="feature-icon"><Fingerprint size={24} /></div>
              <h3>Voice-First Input</h3>
              <p>Speak in your regional language. We translate and draft it in English instantly.</p>
            </div>
          </div>
        </div>
      )}
      
      {step === 'input' && (
        <div className="glass-panel slide-up">
          <h2 style={{ fontSize: '2rem', color: '#fff', marginBottom: '0.5rem', textAlign: 'left' }}>What's the issue?</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Explain the problem you are facing. We'll handle the legal terminology.</p>
          
          {error && (
            <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              {error}
            </div>
          )}

          <div className="ag-input-wrapper">
            {step === 'input' && renderVoicePill()}
            <textarea 
              ref={textareaRef1}
              value={complaint}
              onChange={(e) => setComplaint(e.target.value)}
              placeholder="Ask anything, @ to mention, / for actions"
            />
            <div className="ag-bottom-bar">
              <div className="ag-left-actions">
              </div>
              <div className="ag-right-actions">
                <button 
                  className={`ag-mic-btn ${isListening ? 'listening' : ''}`}
                  onClick={handleMicClick}
                  title={isListening ? "Stop Dictation" : "Dictate your issue"}
                >
                  {isListening ? <AudioLines size={18} className="pulse-icon" /> : <Mic size={18} />}
                </button>
                <button 
                  className="ag-submit-btn"
                  onClick={handleSubmit}
                  title="Generate Legal Draft"
                >
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 'details' && (
        <div className="glass-panel slide-up">
          <h2 style={{ fontSize: '1.8rem', color: '#fff', marginBottom: '1rem', textAlign: 'left' }}>Required Legal Details</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            To make this legally binding, we need a few more details before drafting the RTI:
          </p>
          
          <ul style={{ color: '#e5e7eb', marginBottom: '1.5rem', paddingLeft: '1.5rem' }}>
            {missingQuestions.map((q, idx) => (
              <li key={idx} style={{ marginBottom: '0.5rem', fontSize: '1.1rem' }}>{q}</li>
            ))}
          </ul>
          
          {error && (
            <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              {error}
            </div>
          )}

          <div className="ag-input-wrapper">
            {step === 'details' && renderVoicePill()}
            <textarea 
              ref={textareaRef2}
              value={additionalDetails}
              onChange={(e) => setAdditionalDetails(e.target.value)}
              placeholder="Type your details here (Name, Address, Pincode, etc)..."
            />
            <div className="ag-bottom-bar">
              <div className="ag-left-actions">
              </div>
              <div className="ag-right-actions">
                <button 
                  className={`ag-mic-btn ${isListening ? 'listening' : ''}`}
                  onClick={handleMicClick}
                  title={isListening ? "Stop Dictation" : "Dictate your details"}
                >
                  {isListening ? <AudioLines size={18} className="pulse-icon" /> : <Mic size={18} />}
                </button>
                <button 
                  className="ag-submit-btn"
                  onClick={handleSubmit}
                  title="Finalize Draft"
                >
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 'processing' && (
        <div className="glass-panel slide-up">
          <div className="ai-processing">
            <div className="orb-container">
              <div className="orb-ring"></div>
              <div className="orb-ring"></div>
              <div className="orb"></div>
            </div>
            <div className="processing-text">{processingText}</div>
          </div>
        </div>
      )}

      {step === 'review' && rtiData && (
        <div className="review-layout slide-up">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="original-panel">
              <h3>Your Original Input</h3>
              <p style={{ fontStyle: 'italic', color: '#e5e7eb', lineHeight: '1.5' }}>"{complaint}"</p>
            </div>
            
            <div className="original-panel" style={{ background: 'rgba(59, 130, 246, 0.05)' }}>
              <h3>Secure Routing</h3>
              <div className="map-container">
                <div className="location-dot start" title="You"></div>
                <div className="map-line"></div>
                <div className="location-dot end" title="New Delhi"></div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--text-main)' }}>
                <ShieldCheck className="text-accent" />
                <span style={{ fontSize: '0.9rem' }}>End-to-End Encrypted Transfer to Govt. Servers</span>
              </div>
            </div>
          </div>

          <div className="draft-panel">
            <div className="meta-info">
              <div className="meta-pill">
                <Building size={16} /> <strong>Ministry:</strong> {rtiData.ministry}
              </div>
              <div className="meta-pill">
                <Briefcase size={16} /> <strong>Authority:</strong> {rtiData.authority}
              </div>
            </div>
            
            <div className="document-body" style={{ whiteSpace: 'pre-wrap' }}>
              {rtiData.draft}
            </div>

            <button className="payment-btn" onClick={() => setStep('success')}>
              Pay ₹10 Govt Fee & Submit <ArrowRight size={20} />
            </button>
          </div>
        </div>
      )}

      {step === 'success' && (
        <div className="glass-panel slide-up">
          <div className="success-container">
            <div className="success-icon">
              <CheckCircle size={48} />
            </div>
            <h2 style={{ color: 'var(--text-main)', marginBottom: '1rem' }}>RTI Filed Successfully!</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>
              Your application has been securely transmitted to the {rtiData?.ministry}. By law, they must respond within 30 days.
            </p>
            <div className="tracking-card">
              TRACKING ID: IND-RTI-{Math.random().toString(36).substr(2, 9).toUpperCase()}
            </div>
            <button 
              className="btn-primary" 
              style={{ marginTop: '2rem', width: 'auto', margin: '2rem auto 0' }}
              onClick={() => { setStep('landing'); setComplaint(''); }}
            >
              Back to Home
            </button>
          </div>
        </div>
      )}
    </>
  );
}
