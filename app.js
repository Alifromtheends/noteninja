/**
 * NoteNinja — Voice-to-Text Meeting Notes with AI Action Item Extraction
 */

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

let isRecording = false;
let recordingTimer = null;
let recordingSeconds = 0;

// ─── Recording Simulation ───
function toggleRecording() {
  const btn = document.getElementById('record-btn');
  const text = document.getElementById('record-text');
  const icon = document.querySelector('.record-icon');
  const waveform = document.getElementById('waveform');

  if (!isRecording) {
    // Start
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
    
    // Simulate transcript after 3 seconds
    setTimeout(() => {
      if (isRecording) {
        loadDemo();
      }
    }, 3000);
    
  } else {
    // Stop
    isRecording = false;
    btn.classList.remove('recording');
    text.textContent = 'Start Recording';
    icon.textContent = '🔴';
    waveform.classList.remove('recording');
    clearInterval(recordingTimer);
  }
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
}

// ─── AI Action Extraction ───
function extractActions() {
  const text = document.getElementById('transcript').value.trim();
  if (!text) {
    showToast('Enter a transcript first!', 'error');
    return;
  }

  const actions = extractActionItems(text);
  const summary = generateSummary(text, actions);
  
  renderActions(actions);
  renderSummary(summary);
  
  document.getElementById('results-section').style.display = 'block';
  document.getElementById('export-section').style.display = 'block';
  document.getElementById('action-count').textContent = `${actions.length} found`;
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
        
        // Extract assignee
        const assignee = extractAssignee(sentence);
        
        // Extract deadline
        const deadline = extractDeadline(sentence);
        
        // Check for duplicates
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
            id: Date.now() + Math.random().toString(36).slice(2)
          });
          matched = true;
          break;
        }
      }
    }
    
    // Fallback: look for names + verbs
    if (!matched) {
      const nameVerbMatch = sentence.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b.*\b(will|should|needs? to|is going to|has to)\b\s+(.+)/i);
      if (nameVerbMatch) {
        const assignee = nameVerbMatch[1];
        const actionText = sentence.replace(/^\b(Alright|So|Okay|Well|Now|Then|Also)\b\s*/i, '').trim();
        const deadline = extractDeadline(sentence);
        
        const isDup = actions.some(a => a.text.toLowerCase().includes(actionText.toLowerCase().slice(0, 20)));
        if (!isDup && actionText.length > 15 && actionText.length < 200) {
          actions.push({
            text: actionText.charAt(0).toUpperCase() + actionText.slice(1),
            assignee,
            deadline,
            type: 'assignment',
            done: false,
            id: Date.now() + Math.random().toString(36).slice(2)
          });
        }
      }
    }
  }
  
  return actions.slice(0, 10); // Cap at 10
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
function renderActions(actions) {
  const container = document.getElementById('action-list');
  
  if (actions.length === 0) {
    container.innerHTML = '<div class="empty-state">No action items found. Try a longer transcript.</div>';
    return;
  }
  
  container.innerHTML = actions.map(action => `
    <div class="action-item" data-id="${action.id}">
      <div class="action-checkbox ${action.done ? 'checked' : ''}" onclick="toggleAction('${action.id}')"></div>
      <div class="action-text ${action.done ? 'done' : ''}">
        ${escapeHtml(action.text)}
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
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ─── Export ───
function exportMarkdown() {
  const transcript = document.getElementById('transcript').value;
  const actions = Array.from(document.querySelectorAll('.action-item')).map(item => ({
    text: item.querySelector('.action-text').childNodes[0].textContent.trim(),
    assignee: item.querySelector('.action-assignee')?.textContent.replace('👤 ', '') || '',
    deadline: item.querySelector('.action-deadline')?.textContent.replace('⏰ ', '') || '',
    done: item.querySelector('.action-checkbox').classList.contains('checked')
  }));
  
  const md = `# Meeting Notes\n\n## Transcript\n\n${transcript}\n\n## Action Items\n\n${actions.map(a => `- [${a.done ? 'x' : ' '}] ${a.text}${a.assignee ? ` — @${a.assignee}` : ''}${a.deadline ? ` *(by ${a.deadline})*` : ''}`).join('\n')}\n\n---\n_Extracted by NoteNinja 🥷_`;
  
  downloadFile(md, 'meeting-notes.md', 'text/markdown');
}

function exportJSON() {
  const data = {
    transcript: document.getElementById('transcript').value,
    actions: Array.from(document.querySelectorAll('.action-item')).map(item => ({
      text: item.querySelector('.action-text').childNodes[0].textContent.trim(),
      assignee: item.querySelector('.action-assignee')?.textContent.replace('👤 ', '') || null,
      deadline: item.querySelector('.action-deadline')?.textContent.replace('⏰ ', '') || null,
      done: item.querySelector('.action-checkbox').classList.contains('checked')
    })),
    extractedAt: new Date().toISOString()
  };
  
  downloadFile(JSON.stringify(data, null, 2), 'meeting-notes.json', 'application/json');
}

function copyToClipboard() {
  const text = document.getElementById('transcript').value;
  const actions = Array.from(document.querySelectorAll('.action-item')).map(item => {
    const textEl = item.querySelector('.action-text');
    const mainText = textEl.childNodes[0].textContent.trim();
    const assignee = textEl.querySelector('.action-assignee')?.textContent.replace('👤 ', '') || '';
    const deadline = textEl.querySelector('.action-deadline')?.textContent.replace('⏰ ', '') || '';
    const done = item.querySelector('.action-checkbox').classList.contains('checked');
    return `[${done ? '✓' : ' '}] ${mainText}${assignee ? ` (${assignee})` : ''}${deadline ? ` — ${deadline}` : ''}`;
  }).join('\n');
  
  const full = `Meeting Notes\n\n${text}\n\nAction Items:\n${actions}`;
  
  navigator.clipboard.writeText(full).then(() => {
    showToast('📋 Copied to clipboard!');
  });
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
