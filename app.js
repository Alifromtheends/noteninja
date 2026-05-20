/**
 * NoteNinja — Voice-to-Text Meeting Notes with AI Action Item Extraction
 */

// ─── State ───
let isRecording = false;
let recordingTimer = null;
let recordingSeconds = 0;
let recognition = null;
let currentActions = [];
let currentSummary = null;
let currentTranscript = '';
let actionFilter = 'all';

// ─── Speech API Detection ───
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const speechSupported = !!SpeechRecognition;

// ─── Toast Notification ───
function showToast(message, type = 'success') {
  const existing = document.querySelector('.noteninja-toast');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.className = 'noteninja-toast';
  toast.style.cssText = `
    position: fixed; top: 20px; right: 20px; z-index: 9999;
    padding: 14px 24px; border-radius: 10px; font-size: 14px;
    font-weight: 500; color: white; transform: translateX(120%);
    transition: transform 0.3s ease, opacity 0.3s ease;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    background: ${type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#10b981'};
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  requestAnimationFrame(() => { toast.style.transform = 'translateX(0)'; });
  
  setTimeout(() => {
    toast.style.transform = 'translateX(120%)';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ─── Speech Recognition ───
function initSpeechRecognition() {
  if (!speechSupported) return;
  
  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';
  
  recognition.onresult = (event) => {
    let finalTranscript = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcript + ' ';
      }
    }
    if (finalTranscript) {
      const textarea = document.getElementById('transcript');
      textarea.value += finalTranscript;
    }
  };
  
  recognition.onerror = (event) => {
    console.error('Speech recognition error', event.error);
    if (event.error !== 'no-speech' && event.error !== 'aborted') {
      showToast('Speech error: ' + event.error, 'error');
    }
  };
  
  recognition.onend = () => {
    if (isRecording && recognition) {
      try { recognition.start(); } catch (e) {}
    }
  };
}

function updateSpeechStatus() {
  const statusEl = document.getElementById('speech-status');
  if (!statusEl) return;
  if (speechSupported) {
    statusEl.textContent = '✅ Speech recognition ready';
    statusEl.className = 'speech-status supported';
  } else {
    statusEl.textContent = '⚠️ Speech API not supported — use Load Demo';
    statusEl.className = 'speech-status unsupported';
  }
}

// ─── Recording ───
function toggleRecording() {
  if (!speechSupported) {
    showToast('Speech recognition not supported in this browser. Use Load Demo instead.', 'warning');
    return;
  }

  const btn = document.getElementById('record-btn');
  const text = document.getElementById('record-text');
  const icon = document.querySelector('.record-icon');
  const waveform = document.getElementById('waveform');

  if (!isRecording) {
    isRecording = true;
    btn.classList.add('recording');
    text.textContent = 'Stop Recording';
    icon.textContent = '⏹️';
    waveform.classList.add('recording');
    
    recordingSeconds = 0;
    updateTimer();
    recordingTimer = setInterval(() => {
      recordingSeconds++;
      updateTimer();
    }, 1000);
    
    try {
      recognition.start();
      showToast('🎙️ Recording started — speak now!');
    } catch (e) {
      showToast('Could not start recording', 'error');
      stopRecordingUI();
    }
  } else {
    stopRecordingUI();
    if (recognition) {
      try { recognition.stop(); } catch (e) {}
    }
    showToast('🛑 Recording stopped');
    
    if (document.getElementById('transcript').value.trim()) {
      setTimeout(() => extractActions(), 300);
    }
  }
}

function stopRecordingUI() {
  isRecording = false;
  const btn = document.getElementById('record-btn');
  const text = document.getElementById('record-text');
  const icon = document.querySelector('.record-icon');
  const waveform = document.getElementById('waveform');
  
  btn.classList.remove('recording');
  text.textContent = 'Start Recording';
  icon.textContent = '🔴';
  waveform.classList.remove('recording');
  clearInterval(recordingTimer);
}

function updateTimer() {
  const mins = Math.floor(recordingSeconds / 60).toString().padStart(2, '0');
  const secs = (recordingSeconds % 60).toString().padStart(2, '0');
  document.getElementById('timer').textContent = `${mins}:${secs}`;
}

// ─── Demo Data ───
const demoTranscript = `Alright team, let's wrap up this sprint planning.

First, the API integration needs to be completed by Friday. John, you mentioned you'd handle the authentication module — can you also review the error handling before we merge?

Sarah, the design mockups for the dashboard are looking great. We need those finalized by Wednesday so the frontend team can start implementation. Please share the Figma link in Slack after this call.

Mike, I need you to review the pull request for the database schema changes. There are some concerns about the indexing strategy that we should address before going to production. Let's aim for tomorrow EOD.

Oh, and one more thing — we need to schedule a user testing session for next week. Emma, can you coordinate with the QA team and find a time that works for everyone? Preferably Tuesday or Thursday morning.

Finally, everyone please update your Jira tickets by end of day. The PM needs visibility for the stakeholder meeting on Monday.

Any questions? No? Great, let's get to work.`;

function loadDemo() {
  document.getElementById('transcript').value = demoTranscript;
  extractActions();
}

function clearTranscript() {
  document.getElementById('transcript').value = '';
  document.getElementById('action-list').innerHTML = '<div class="empty-state">Extract action items to see them here</div>';
  document.getElementById('summary-content').innerHTML = '<div class="empty-state">Meeting summary will appear here</div>';
  document.getElementById('action-count').textContent = '0 found';
  document.getElementById('results-section').style.display = 'none';
  document.getElementById('export-section').style.display = 'none';
  currentActions = [];
  currentSummary = null;
  currentTranscript = '';
}

// ─── AI Action Extraction ───
function extractActions() {
  const text = document.getElementById('transcript').value.trim();
  if (!text) {
    showToast('Enter a transcript first!', 'error');
    return;
  }

  currentTranscript = text;
  const actions = extractActionItems(text);
  const summary = generateSummary(text, actions);
  
  currentActions = actions;
  currentSummary = summary;
  
  setActionFilter('all');
  renderSummary(summary);
  
  document.getElementById('results-section').style.display = 'block';
  document.getElementById('export-section').style.display = 'block';
  document.getElementById('action-count').textContent = `${actions.length} found`;
  
  saveMeeting(text, actions, summary);
}

function extractActionItems(text) {
  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10);
  const actions = [];
  
  const actionPatterns = [
    { regex: /\b(need|needs|needed)\s+(?:to|for)\s+(.+)/i, type: 'need' },
    { regex: /\b(should|must|have to|needs to)\s+(.+)/i, type: 'directive' },
    { regex: /\b(can you|could you|would you|will you)\s+(.+)/i, type: 'request' },
    { regex: /\b(please)\s+(.+)/i, type: 'request' },
    { regex: /\b(assigned to|responsible for|in charge of|handling)\s+(.+)/i, type: 'assignment' },
    { regex: /\b(by|before|until|no later than)\s+(.+?)(?:\.|,|;|$)/i, type: 'deadline' },
    { regex: /\b(schedule|plan|set up|organize|coordinate)\s+(.+)/i, type: 'schedule' },
    { regex: /\b(review|check|verify|approve|sign off on)\s+(.+)/i, type: 'review' },
    { regex: /\b(update|complete|finish|finalize|deliver)\s+(.+)/i, type: 'task' },
  ];
  
  for (const sentence of sentences) {
    let matched = false;
    
    for (const pattern of actionPatterns) {
      const match = sentence.match(pattern.regex);
      if (match) {
        const actionText = match[0].replace(/^\b(Alright|So|Okay|Well|Now|Then|Also)\b\s*/i, '').trim();
        
        if (actionText.length < 15 || actionText.length > 200) continue;
        
        const assignee = extractAssignee(sentence);
        const deadline = extractDeadline(sentence);
        const confidence = computeConfidence(pattern.type, assignee, deadline, false);
        
        const isDup = actions.some(a => 
          a.text.toLowerCase().includes(actionText.toLowerCase().slice(0, 20)) ||
          actionText.toLowerCase().includes(a.text.toLowerCase().slice(0, 20))
        );
        
        if (!isDup) {
          actions.push({
            text: actionText.charAt(0).toUpperCase() + actionText.slice(1),
            assignee,
            deadline,
            type: pattern.type,
            done: false,
            id: Date.now() + Math.random().toString(36).slice(2),
            confidence
          });
          matched = true;
          break;
        }
      }
    }
    
    if (!matched) {
      const nameVerbMatch = sentence.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b.*\b(will|should|needs? to|is going to|has to)\b\s+(.+)/i);
      if (nameVerbMatch) {
        const assignee = nameVerbMatch[1];
        const actionText = sentence.replace(/^\b(Alright|So|Okay|Well|Now|Then|Also)\b\s*/i, '').trim();
        const deadline = extractDeadline(sentence);
        const confidence = computeConfidence('assignment', assignee, deadline, true);
        
        const isDup = actions.some(a => a.text.toLowerCase().includes(actionText.toLowerCase().slice(0, 20)));
        if (!isDup && actionText.length > 15 && actionText.length < 200) {
          actions.push({
            text: actionText.charAt(0).toUpperCase() + actionText.slice(1),
            assignee,
            deadline,
            type: 'assignment',
            done: false,
            id: Date.now() + Math.random().toString(36).slice(2),
            confidence
          });
        }
      }
    }
  }
  
  return actions.slice(0, 10);
}

function computeConfidence(patternType, assignee, deadline, isFallback) {
  if (isFallback) {
    return (assignee && deadline) ? 'medium' : 'low';
  }
  
  const strongPatterns = ['request', 'directive', 'assignment'];
  const mediumPatterns = ['need', 'schedule', 'review', 'task'];
  
  let score = 0;
  if (strongPatterns.includes(patternType)) score += 0.5;
  else if (mediumPatterns.includes(patternType)) score += 0.3;
  else score += 0.2;
  
  if (assignee) score += 0.25;
  if (deadline) score += 0.25;
  
  if (score >= 0.75) return 'high';
  if (score >= 0.5) return 'medium';
  return 'low';
}

function extractAssignee(sentence) {
  const nameMatch = sentence.match(/\b([A-Z][a-zA-Z]{2,15})\b/);
  if (nameMatch) {
    const name = nameMatch[1];
    const exclude = ['I', 'The', 'We', 'This', 'That', 'There', 'What', 'When', 'Where', 'Which', 'While', 'Who', 'Why', 'How', 'All', 'Any', 'Both', 'Each', 'More', 'Most', 'Other', 'Some', 'Such', 'Only', 'Own', 'Same', 'So', 'Than', 'Too', 'Very', 'Just', 'But', 'Not', 'Also', 'Can', 'Could', 'Would', 'Should', 'May', 'Might', 'Must', 'Shall', 'Will', 'About', 'After', 'Before', 'During', 'Into', 'Through', 'Above', 'Below', 'Between', 'Under', 'Again', 'Further', 'Then', 'Once', 'Here', 'There', 'Everywhere', 'Anywhere', 'Now', 'Later', 'Soon', 'Today', 'Tomorrow', 'Yesterday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'Slack', 'Jira', 'Figma', 'API', 'QA', 'PM', 'EOD', 'Alright', 'Okay', 'Great'];
    if (!exclude.includes(name)) return name;
  }
  return null;
}

function extractDeadline(sentence) {
  const deadlinePatterns = [
    /\b(by|before|until|no later than)\s+(.+?)(?:\.|,|;|$)/i,
    /\b(this|next)\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|week|month)/i,
    /\b(tomorrow|today|EOD|end of day|end of week)/i,
    /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+morning|afternoon|evening/i,
  ];
  
  for (const pattern of deadlinePatterns) {
    const match = sentence.match(pattern);
    if (match) return match[0].replace(/\b(by|before|until|no later than)\s+/i, '').replace(/[.,;]$/, '');
  }
  return null;
}

function generateSummary(text, actions) {
  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 20);
  const keyTopics = extractTopics(text);
  
  return {
    duration: `${Math.ceil(sentences.length * 0.3)} min`,
    participants: [...new Set(actions.map(a => a.assignee).filter(Boolean))],
    topics: keyTopics,
    actionCount: actions.length,
    keyDecisions: sentences.filter(s => 
      /\b(decided|decision|agreed|consensus|conclusion|resolution)\b/i.test(s)
    ).slice(0, 3)
  };
}

function extractTopics(text) {
  const topicWords = text.toLowerCase().match(/\b\w{4,}\b/g) || [];
  const stopWords = new Set(['this', 'that', 'with', 'from', 'they', 'have', 'were', 'been', 'their', 'said', 'each', 'which', 'will', 'about', 'there', 'could', 'other', 'after', 'first', 'never', 'these', 'think', 'where', 'being', 'every', 'great', 'might', 'shall', 'while', 'those', 'both', 'upon', 'dont', 'does', 'made', 'make', 'take', 'come', 'know', 'want', 'like', 'just', 'over', 'into', 'time', 'more', 'very', 'what', 'when', 'them', 'than', 'only', 'some', 'come', 'time', 'year', 'work', 'also', 'back', 'after', 'use', 'two', 'how', 'way', 'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us']);
  
  const freq = {};
  topicWords.forEach(w => { if (!stopWords.has(w)) freq[w] = (freq[w] || 0) + 1; });
  
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word.charAt(0).toUpperCase() + word.slice(1));
}

// ─── Rendering ───
function renderActions(actions, filter = 'all') {
  const container = document.getElementById('action-list');
  
  let filtered = [...actions];
  if (filter === 'completed') filtered = actions.filter(a => a.done);
  else if (filter === 'pending') filtered = actions.filter(a => !a.done);
  else if (filter === 'assignee') filtered = actions.filter(a => a.assignee).sort((a, b) => (a.assignee || '').localeCompare(b.assignee || ''));
  else if (filter === 'deadline') filtered = actions.filter(a => a.deadline).sort((a, b) => (a.deadline || '').localeCompare(b.deadline || ''));
  
  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state">No action items match this filter.</div>';
    return;
  }
  
  container.innerHTML = filtered.map(action => `
    <div class="action-item" data-id="${action.id}">
      <div class="action-checkbox ${action.done ? 'checked' : ''}" onclick="toggleAction('${action.id}')"></div>
      <div class="action-text ${action.done ? 'done' : ''}">
        <div class="action-row">
          <span>${escapeHtml(action.text)}</span>
          ${action.confidence ? `<span class="confidence-badge confidence-${action.confidence}">${action.confidence}</span>` : ''}
        </div>
        ${action.assignee ? `<div class="action-assignee">👤 ${escapeHtml(action.assignee)}</div>` : ''}
        ${action.deadline ? `<div class="action-deadline">⏰ ${escapeHtml(action.deadline)}</div>` : ''}
      </div>
    </div>
  `).join('');
}

function renderSummary(summary) {
  const container = document.getElementById('summary-content');
  
  container.innerHTML = `
    <p><strong>📊 Meeting Overview</strong></p>
    <p>Duration: ~${summary.duration} • ${summary.actionCount} action items extracted</p>
    
    ${summary.participants.length > 0 ? `
    <p><strong>👥 Participants</strong></p>
    <p>${summary.participants.map(p => `<span style="color:var(--primary-light)">${escapeHtml(p)}</span>`).join(', ')}</p>
    ` : ''}
    
    ${summary.topics.length > 0 ? `
    <p><strong>🏷️ Key Topics</strong></p>
    <p>${summary.topics.join(' • ')}</p>
    ` : ''}
    
    ${summary.keyDecisions.length > 0 ? `
    <p><strong>✅ Key Decisions</strong></p>
    ${summary.keyDecisions.map(d => `<p>• ${escapeHtml(d)}</p>`).join('')}
    ` : ''}
  `;
}

function toggleAction(id) {
  const item = document.querySelector(`[data-id="${id}"]`);
  if (!item) return;
  
  const checkbox = item.querySelector('.action-checkbox');
  const text = item.querySelector('.action-text');
  
  checkbox.classList.toggle('checked');
  text.classList.toggle('done');
  
  const action = currentActions.find(a => a.id === id);
  if (action) {
    action.done = !action.done;
    const meetings = JSON.parse(localStorage.getItem('noteninja-meetings') || '[]');
    const meeting = meetings.find(m => m.actions.some(a => a.id === id));
    if (meeting) {
      const histAction = meeting.actions.find(a => a.id === id);
      if (histAction) histAction.done = action.done;
      localStorage.setItem('noteninja-meetings', JSON.stringify(meetings));
    }
  }
}

function setActionFilter(filter) {
  actionFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });
  renderActions(currentActions, filter);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ─── Meeting History ───
function saveMeeting(transcript, actions, summary) {
  const meetings = JSON.parse(localStorage.getItem('noteninja-meetings') || '[]');
  const meeting = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    date: new Date().toISOString(),
    title: generateMeetingTitle(transcript),
    transcript,
    actions: JSON.parse(JSON.stringify(actions)),
    summary
  };
  meetings.unshift(meeting);
  if (meetings.length > 50) meetings.pop();
  localStorage.setItem('noteninja-meetings', JSON.stringify(meetings));
  renderHistory();
}

function generateMeetingTitle(transcript) {
  const firstLine = transcript.split('\n')[0].trim();
  if (firstLine.length > 5 && firstLine.length < 60) return firstLine;
  const date = new Date();
  return `Meeting — ${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
}

function renderHistory() {
  const container = document.getElementById('history-list');
  if (!container) return;
  const meetings = JSON.parse(localStorage.getItem('noteninja-meetings') || '[]');
  
  if (meetings.length === 0) {
    container.innerHTML = '<div class="history-empty">No saved meetings yet</div>';
    return;
  }
  
  container.innerHTML = meetings.map(m => `
    <div class="history-item" onclick="loadMeeting('${m.id}')">
      <div class="history-title">${escapeHtml(m.title)}</div>
      <div class="history-meta">${new Date(m.date).toLocaleDateString()} • ${m.actions.length} actions</div>
    </div>
  `).join('');
}

function toggleHistoryDropdown() {
  const dropdown = document.getElementById('history-dropdown');
  if (dropdown) dropdown.classList.toggle('open');
}

function loadMeeting(id) {
  const meetings = JSON.parse(localStorage.getItem('noteninja-meetings') || '[]');
  const meeting = meetings.find(m => m.id === id);
  if (!meeting) return;
  
  document.getElementById('transcript').value = meeting.transcript;
  currentActions = meeting.actions.map(a => ({...a}));
  currentSummary = meeting.summary;
  currentTranscript = meeting.transcript;
  
  setActionFilter('all');
  renderSummary(meeting.summary);
  
  document.getElementById('results-section').style.display = 'block';
  document.getElementById('export-section').style.display = 'block';
  document.getElementById('action-count').textContent = `${meeting.actions.length} found`;
  
  showToast('📂 Meeting loaded from history');
  
  const dropdown = document.getElementById('history-dropdown');
  if (dropdown) dropdown.classList.remove('open');
}

// ─── Export ───
function exportMarkdown() {
  const transcript = currentTranscript || document.getElementById('transcript').value;
  const actions = currentActions;
  
  if (!transcript.trim()) {
    showToast('Nothing to export!', 'error');
    return;
  }
  
  const md = `# Meeting Notes\n\n## Transcript\n\n${transcript}\n\n## Action Items\n\n${actions.map(a => `- [${a.done ? 'x' : ' '}] ${a.text}${a.assignee ? ` — @${a.assignee}` : ''}${a.deadline ? ` *(by ${a.deadline})*` : ''}`).join('\n')}\n\n---\n_Extracted by NoteNinja 🥷_`;
  
  downloadFile(md, 'meeting-notes.md', 'text/markdown');
}

function exportJSON() {
  const data = {
    transcript: currentTranscript || document.getElementById('transcript').value,
    actions: currentActions.map(a => ({...a})),
    extractedAt: new Date().toISOString()
  };
  
  downloadFile(JSON.stringify(data, null, 2), 'meeting-notes.json', 'application/json');
}

function copyToClipboard() {
  const text = currentTranscript || document.getElementById('transcript').value;
  const actions = currentActions;
  
  const actionText = actions.map(a => {
    return `[${a.done ? '✓' : ' '}] ${a.text}${a.assignee ? ` (${a.assignee})` : ''}${a.deadline ? ` — ${a.deadline}` : ''}`;
  }).join('\n');
  
  const full = `Meeting Notes\n\n${text}\n\nAction Items:\n${actionText}`;
  
  navigator.clipboard.writeText(full).then(() => {
    showToast('📋 Copied to clipboard!');
  });
}

function shareEmail() {
  const transcript = currentTranscript || document.getElementById('transcript').value;
  const actions = currentActions;
  const summary = currentSummary;
  
  if (!transcript.trim()) {
    showToast('Nothing to share yet!', 'error');
    return;
  }
  
  let body = `Meeting Notes\n\n`;
  body += `Duration: ~${summary?.duration || 'N/A'}\n`;
  body += `Action Items: ${actions?.length || 0}\n\n`;
  
  body += `--- Action Items ---\n`;
  if (actions && actions.length) {
    body += actions.map(a => `[${a.done ? 'x' : ' '}] ${a.text}${a.assignee ? ` (@${a.assignee})` : ''}${a.deadline ? ` by ${a.deadline}` : ''}`).join('\n');
  } else {
    body += 'No action items extracted.';
  }
  
  body += `\n\n--- Transcript ---\n${transcript}`;
  body += `\n\n---\nSent from NoteNinja 🥷`;
  
  const subject = encodeURIComponent('NoteNinja Meeting Notes');
  const encodedBody = encodeURIComponent(body);
  window.location.href = `mailto:?subject=${subject}&body=${encodedBody}`;
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Init ───
document.addEventListener('DOMContentLoaded', () => {
  initSpeechRecognition();
  updateSpeechStatus();
  renderHistory();
});

document.addEventListener('click', (e) => {
  const wrapper = document.querySelector('.history-dropdown-wrapper');
  if (wrapper && !wrapper.contains(e.target)) {
    const dropdown = document.getElementById('history-dropdown');
    if (dropdown) dropdown.classList.remove('open');
  }
});
