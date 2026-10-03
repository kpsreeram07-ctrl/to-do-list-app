/**
 * ==============================================================================
 * TaskFlow - JavaScript Engine (script.js)
 * Week 2 Project 1: To-Do List Web App with Gemini AI Assistant
 * Stack: HTML5, CSS3, Vanilla JavaScript, Browser LocalStorage, Gemini API
 * ==============================================================================
 */

// --- LocalStorage Keys ---
const STORAGE_KEYS = {
  TASKS: 'taskflow_tasks_v2',
  LEGACY_TASKS: 'todo_app_tasks_v1',
  THEME: 'taskflow_theme_mode',
  CHAT: 'taskflow_chat_history_v1',
};

// --- Application State ---
let tasks = [];
let currentFilter = 'all'; // 'all' | 'active' | 'completed'
let searchQuery = '';
let chatHistory = []; // Array of { role: 'user' | 'model', text: string }
let isSubmittingTask = false;
let isSendingChat = false;

// --- DOM Elements ---
// Header & Theme
const themeToggleBtn = document.getElementById('themeToggleBtn');
const themeIcon = document.getElementById('themeIcon');
const themeText = document.getElementById('themeText');

// Dashboard Stats
const statTotal = document.getElementById('statTotal');
const statCompleted = document.getElementById('statCompleted');
const statRemaining = document.getElementById('statRemaining');

// Task Form
const todoForm = document.getElementById('todoForm');
const taskInput = document.getElementById('taskInput');
const prioritySelect = document.getElementById('prioritySelect');
const dueDateInput = document.getElementById('dueDateInput');
const addTaskBtn = document.getElementById('addTaskBtn');

// Search & Filters
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const filterButtons = document.querySelectorAll('.filter-btn');
const clearCompletedBtn = document.getElementById('clearCompletedBtn');

// Task List & Empty State
const taskList = document.getElementById('taskList');
const emptyState = document.getElementById('emptyState');

// Edit Modal
const editModal = document.getElementById('editModal');
const editForm = document.getElementById('editForm');
const editTaskId = document.getElementById('editTaskId');
const editTaskText = document.getElementById('editTaskText');
const editPrioritySelect = document.getElementById('editPrioritySelect');
const editDueDateInput = document.getElementById('editDueDateInput');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');

// Gemini AI Assistant
const apiKeyBanner = document.getElementById('apiKeyBanner');
const chatMessages = document.getElementById('chatMessages');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const sendChatBtn = document.getElementById('sendChatBtn');
const chatLoading = document.getElementById('chatLoading');
const clearChatBtn = document.getElementById('clearChatBtn');
const aiChips = document.querySelectorAll('.ai-chip');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  loadTasks();
  loadChatHistory();
  renderTasks();
  setupEventListeners();
  checkGeminiApiStatus();
  taskInput.focus();
});

// --- Event Listeners Setup ---
function setupEventListeners() {
  // Theme toggle
  themeToggleBtn.addEventListener('click', toggleTheme);

  // Task creation form
  todoForm.addEventListener('submit', handleAddTask);

  // Search tasks input
  searchInput.addEventListener('input', handleSearchInput);
  clearSearchBtn.addEventListener('click', clearSearch);

  // Filter tabs
  filterButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const filter = btn.getAttribute('data-filter');
      setFilter(filter);
    });
  });

  // Clear completed tasks
  clearCompletedBtn.addEventListener('click', handleClearCompleted);

  // Delegated clicks on task list (complete, edit, delete)
  taskList.addEventListener('click', handleTaskListAction);

  // Edit modal events
  editForm.addEventListener('submit', handleSaveEditTask);
  closeModalBtn.addEventListener('click', closeEditModal);
  cancelEditBtn.addEventListener('click', closeEditModal);
  editModal.addEventListener('click', (e) => {
    if (e.target === editModal) closeEditModal();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && editModal.style.display !== 'none') {
      closeEditModal();
    }
  });

  // Remove input error shake on typing
  taskInput.addEventListener('input', () => {
    taskInput.classList.remove('input-error');
  });

  // Gemini Chat
  chatForm.addEventListener('submit', handleChatSubmit);
  clearChatBtn.addEventListener('click', handleClearChat);

  // AI quick prompt suggestion chips
  aiChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const prompt = chip.getAttribute('data-prompt');
      if (prompt) {
        chatInput.value = prompt;
        chatForm.dispatchEvent(new Event('submit'));
      }
    });
  });
}

// ==============================================================================
// Theme Management (Light / Dark Mode)
// ==============================================================================
function initTheme() {
  const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME);
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = savedTheme ? savedTheme === 'dark' : prefersDark;

  applyTheme(isDark);
}

function toggleTheme() {
  const isCurrentlyDark = document.body.classList.contains('dark-mode');
  applyTheme(!isCurrentlyDark);
}

function applyTheme(isDark) {
  if (isDark) {
    document.body.classList.add('dark-mode');
    themeIcon.textContent = '☀️';
    themeText.textContent = 'Light Mode';
    localStorage.setItem(STORAGE_KEYS.THEME, 'dark');
  } else {
    document.body.classList.remove('dark-mode');
    themeIcon.textContent = '🌙';
    themeText.textContent = 'Dark Mode';
    localStorage.setItem(STORAGE_KEYS.THEME, 'light');
  }
}

// ==============================================================================
// LocalStorage Operations
// ==============================================================================
function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TASKS);
    if (raw) {
      tasks = JSON.parse(raw);
    } else {
      // Check legacy key for backwards compatibility
      const legacyRaw = localStorage.getItem(STORAGE_KEYS.LEGACY_TASKS);
      if (legacyRaw) {
        tasks = JSON.parse(legacyRaw);
        saveTasks(); // Upgrade to v2
      } else {
        // Starter tasks for first-time visitors
        tasks = [
          {
            id: 'task_' + Date.now() + '_1',
            text: 'Review Web Development Lecture Notes',
            completed: false,
            priority: 'high',
            dueDate: getFormattedDateOffset(1),
            createdAt: Date.now() - 3600000,
          },
          {
            id: 'task_' + Date.now() + '_2',
            text: 'Push project updates to GitHub',
            completed: false,
            priority: 'medium',
            dueDate: getFormattedDateOffset(2),
            createdAt: Date.now() - 7200000,
          },
          {
            id: 'task_' + Date.now() + '_3',
            text: 'Set up development environment',
            completed: true,
            priority: 'low',
            dueDate: '',
            createdAt: Date.now() - 10800000,
          },
        ];
        saveTasks();
      }
    }
    if (!Array.isArray(tasks)) tasks = [];
  } catch (err) {
    console.error('Failed to load tasks from localStorage:', err);
    tasks = [];
  }
}

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
  } catch (err) {
    console.error('Failed to save tasks to localStorage:', err);
  }
}

// Helper to get ISO date string offset by days
function getFormattedDateOffset(daysOffset) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().split('T')[0];
}

// ==============================================================================
// Task Operations (Add, Toggle, Delete, Edit)
// ==============================================================================
function handleAddTask(e) {
  e.preventDefault();
  if (isSubmittingTask) return;

  const text = taskInput.value.trim();
  if (!text) {
    taskInput.classList.add('input-error');
    taskInput.focus();
    return;
  }

  isSubmittingTask = true;
  addTaskBtn.disabled = true;

  const newTask = {
    id: 'task_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    text: text,
    completed: false,
    priority: prioritySelect.value || 'medium',
    dueDate: dueDateInput.value || '',
    createdAt: Date.now(),
  };

  tasks.unshift(newTask);
  saveTasks();

  // Reset form inputs
  taskInput.value = '';
  dueDateInput.value = '';
  prioritySelect.value = 'medium';
  taskInput.focus();

  renderTasks();

  // Debounce guard
  setTimeout(() => {
    isSubmittingTask = false;
    addTaskBtn.disabled = false;
  }, 100);
}

function handleTaskListAction(e) {
  const target = e.target;

  // Toggle complete
  const toggleBtn = target.closest('.btn-toggle');
  if (toggleBtn) {
    const id = toggleBtn.getAttribute('data-id');
    toggleTaskComplete(id);
    return;
  }

  // Delete
  const deleteBtn = target.closest('.btn-delete');
  if (deleteBtn) {
    const id = deleteBtn.getAttribute('data-id');
    deleteTask(id);
    return;
  }

  // Edit
  const editBtn = target.closest('.btn-edit');
  if (editBtn) {
    const id = editBtn.getAttribute('data-id');
    openEditModal(id);
    return;
  }
}

function toggleTaskComplete(id) {
  const task = tasks.find((t) => t.id === id);
  if (task) {
    task.completed = !task.completed;
    saveTasks();
    renderTasks();
  }
}

function deleteTask(id) {
  tasks = tasks.filter((t) => t.id !== id);
  saveTasks();
  renderTasks();
}

function handleClearCompleted() {
  const completedCount = tasks.filter((t) => t.completed).length;
  if (completedCount === 0) return;

  tasks = tasks.filter((t) => !t.completed);
  saveTasks();
  renderTasks();
}

// --- Edit Task Modal Logic ---
function openEditModal(id) {
  const task = tasks.find((t) => t.id === id);
  if (!task) return;

  editTaskId.value = task.id;
  editTaskText.value = task.text;
  editPrioritySelect.value = task.priority || 'medium';
  editDueDateInput.value = task.dueDate || '';

  editModal.style.display = 'flex';
  editTaskText.focus();
}

function closeEditModal() {
  editModal.style.display = 'none';
  editForm.reset();
}

function handleSaveEditTask(e) {
  e.preventDefault();
  const id = editTaskId.value;
  const newText = editTaskText.value.trim();

  if (!newText) {
    editTaskText.focus();
    return;
  }

  const task = tasks.find((t) => t.id === id);
  if (task) {
    task.text = newText;
    task.priority = editPrioritySelect.value || 'medium';
    task.dueDate = editDueDateInput.value || '';
    saveTasks();
    renderTasks();
  }

  closeEditModal();
}

// ==============================================================================
// Search & Filter Logic
// ==============================================================================
function handleSearchInput(e) {
  searchQuery = e.target.value.toLowerCase().trim();
  clearSearchBtn.style.display = searchQuery ? 'block' : 'none';
  renderTasks();
}

function clearSearch() {
  searchInput.value = '';
  searchQuery = '';
  clearSearchBtn.style.display = 'none';
  searchInput.focus();
  renderTasks();
}

function setFilter(filter) {
  currentFilter = filter;
  filterButtons.forEach((btn) => {
    const isMatch = btn.getAttribute('data-filter') === filter;
    btn.classList.toggle('active', isMatch);
    btn.setAttribute('aria-selected', isMatch ? 'true' : 'false');
  });
  renderTasks();
}

// ==============================================================================
// UI Rendering & Dashboard Stats
// ==============================================================================
function updateDashboardStats() {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.completed).length;
  const remaining = total - completed;

  statTotal.textContent = total;
  statCompleted.textContent = completed;
  statRemaining.textContent = remaining;

  // Clear completed button visibility
  if (clearCompletedBtn) {
    if (completed > 0) {
      clearCompletedBtn.style.display = 'inline-block';
      clearCompletedBtn.textContent = `🧹 Clear Completed (${completed})`;
    } else {
      clearCompletedBtn.style.display = 'none';
    }
  }
}

function renderTasks() {
  updateDashboardStats();

  // Filter tasks based on currentFilter AND searchQuery
  const filtered = tasks.filter((task) => {
    // Filter status
    if (currentFilter === 'active' && task.completed) return false;
    if (currentFilter === 'completed' && !task.completed) return false;

    // Search query
    if (searchQuery && !task.text.toLowerCase().includes(searchQuery)) {
      return false;
    }

    return true;
  });

  if (filtered.length === 0) {
    taskList.innerHTML = '';
    emptyState.style.display = 'flex';

    const emptyTitle = emptyState.querySelector('.empty-title');
    const emptyDesc = emptyState.querySelector('.empty-desc');

    if (searchQuery) {
      emptyTitle.textContent = 'No matching tasks';
      emptyDesc.textContent = `No tasks matched "${searchQuery}".`;
    } else if (tasks.length === 0) {
      emptyTitle.textContent = 'No tasks yet';
      emptyDesc.textContent = 'Add your first task above to get organized!';
    } else if (currentFilter === 'active') {
      emptyTitle.textContent = 'No active tasks';
      emptyDesc.textContent = 'All tasks are marked as completed!';
    } else if (currentFilter === 'completed') {
      emptyTitle.textContent = 'No completed tasks';
      emptyDesc.textContent = 'Complete tasks to see them listed here.';
    }
    return;
  }

  emptyState.style.display = 'none';
  taskList.innerHTML = '';

  const todayStr = new Date().toISOString().split('T')[0];
  const fragment = document.createDocumentFragment();

  filtered.forEach((task) => {
    const li = document.createElement('li');
    li.className = `task-item ${task.completed ? 'completed' : ''}`;
    li.setAttribute('data-id', task.id);

    // Toggle button (✓)
    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'btn-toggle';
    toggleBtn.setAttribute('data-id', task.id);
    toggleBtn.setAttribute(
      'aria-label',
      task.completed ? 'Mark task as incomplete' : 'Mark task as complete'
    );
    toggleBtn.textContent = '✓';

    // Content container
    const contentDiv = document.createElement('div');
    contentDiv.className = 'task-content';

    // Task name
    const textSpan = document.createElement('span');
    textSpan.className = 'task-text';
    textSpan.textContent = task.text;
    contentDiv.appendChild(textSpan);

    // Meta details (Priority, Due Date, Overdue)
    const metaDiv = document.createElement('div');
    metaDiv.className = 'task-meta';

    // Priority badge
    const priority = (task.priority || 'medium').toLowerCase();
    const priorityBadge = document.createElement('span');
    priorityBadge.className = `badge-priority priority-${priority}`;

    if (priority === 'high') {
      priorityBadge.innerHTML = '🔴 High';
    } else if (priority === 'low') {
      priorityBadge.innerHTML = '🟢 Low';
    } else {
      priorityBadge.innerHTML = '⚡ Medium';
    }
    metaDiv.appendChild(priorityBadge);

    // Due Date badge
    if (task.dueDate) {
      const isOverdue = !task.completed && task.dueDate < todayStr;
      const dateBadge = document.createElement('span');
      dateBadge.className = isOverdue ? 'badge-date badge-overdue' : 'badge-date';
      dateBadge.innerHTML = isOverdue
        ? `⚠️ Overdue (${formatDueDate(task.dueDate)})`
        : `📅 ${formatDueDate(task.dueDate)}`;
      metaDiv.appendChild(dateBadge);
    }

    contentDiv.appendChild(metaDiv);

    // Actions container (Edit & Delete)
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'task-actions';

    // Edit button (✏️)
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn-icon btn-edit';
    editBtn.setAttribute('data-id', task.id);
    editBtn.setAttribute('title', 'Edit task');
    editBtn.setAttribute('aria-label', `Edit task: ${task.text}`);
    editBtn.innerHTML = '✏️';

    // Delete button (🗑️)
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn-icon btn-delete';
    deleteBtn.setAttribute('data-id', task.id);
    deleteBtn.setAttribute('title', 'Delete task');
    deleteBtn.setAttribute('aria-label', `Delete task: ${task.text}`);
    deleteBtn.innerHTML = '🗑️';

    actionsDiv.appendChild(editBtn);
    actionsDiv.appendChild(deleteBtn);

    // Assemble item
    li.appendChild(toggleBtn);
    li.appendChild(contentDiv);
    li.appendChild(actionsDiv);

    fragment.appendChild(li);
  });

  taskList.appendChild(fragment);
}

function formatDueDate(dateString) {
  if (!dateString) return '';
  try {
    const parts = dateString.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const date = new Date(year, month, day);
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });
    }
    return dateString;
  } catch {
    return dateString;
  }
}

// ==============================================================================
// Gemini AI Task Assistant
// ==============================================================================

/**
 * Checks server endpoint to see if GEMINI_API_KEY is configured.
 */
async function checkGeminiApiStatus() {
  try {
    const res = await fetch('/api/gemini/status');
    if (res.ok) {
      const data = await res.json();
      if (!data.available) {
        apiKeyBanner.style.display = 'flex';
      } else {
        apiKeyBanner.style.display = 'none';
      }
    }
  } catch {
    // Non-fatal: user can still use to-do list normally
    apiKeyBanner.style.display = 'none';
  }
}

function loadChatHistory() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.CHAT);
    if (saved) {
      chatHistory = JSON.parse(saved);
      if (Array.isArray(chatHistory) && chatHistory.length > 0) {
        // Re-render saved messages
        chatHistory.forEach((msg) => {
          appendChatMessage(msg.role, msg.text, false);
        });
      }
    }
  } catch (err) {
    console.error('Failed to load chat history:', err);
    chatHistory = [];
  }
}

function saveChatHistory() {
  try {
    localStorage.setItem(STORAGE_KEYS.CHAT, JSON.stringify(chatHistory.slice(-10)));
  } catch (err) {
    console.error('Failed to save chat history:', err);
  }
}

function handleClearChat() {
  chatHistory = [];
  try {
    localStorage.removeItem(STORAGE_KEYS.CHAT);
  } catch {}
  chatMessages.innerHTML = `
    <div class="chat-message assistant-message">
      <div class="message-avatar">✨</div>
      <div class="message-bubble">
        <p>Chat cleared! How can I assist you with your tasks today?</p>
        <p class="message-tip">Ask a question or select any prompt above.</p>
      </div>
    </div>
  `;
}

async function handleChatSubmit(e) {
  e.preventDefault();
  if (isSendingChat) return;

  const prompt = chatInput.value.trim();
  if (!prompt) return;

  // Add user message to UI & history
  appendChatMessage('user', prompt, true);
  chatInput.value = '';
  isSendingChat = true;
  sendChatBtn.disabled = true;
  chatLoading.style.display = 'flex';
  scrollToChatBottom();

  // Prepare tasks payload (text, completed, priority, dueDate)
  const taskPayload = tasks.map((t) => ({
    text: t.text,
    completed: t.completed,
    priority: t.priority,
    dueDate: t.dueDate,
  }));

  try {
    const response = await fetch('/api/gemini/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: prompt,
        tasks: taskPayload,
        history: chatHistory.slice(-6),
      }),
    });

    chatLoading.style.display = 'none';

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message =
        errorData.error ||
        'Gemini Assistant is unavailable. Please configure your Gemini API key in Settings > Secrets.';
      appendChatMessage('model', message, true);
      apiKeyBanner.style.display = 'flex';
      return;
    }

    const data = await response.json();
    const replyText = data.text || 'I analyzed your tasks, but have no response to share.';
    appendChatMessage('model', replyText, true);
    apiKeyBanner.style.display = 'none';
  } catch (err) {
    chatLoading.style.display = 'none';
    console.error('Chat error:', err);
    appendChatMessage(
      'model',
      'Gemini Assistant is unavailable. Please check your network connection or configure your Gemini API key in Settings > Secrets.',
      true
    );
  } finally {
    isSendingChat = false;
    sendChatBtn.disabled = false;
    scrollToChatBottom();
  }
}

function appendChatMessage(role, text, save = true) {
  if (save) {
    chatHistory.push({ role, text });
    saveChatHistory();
  }

  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message ${role === 'user' ? 'user-message' : 'assistant-message'}`;

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.textContent = role === 'user' ? '👤' : '✨';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';

  // Render markdown-like text safely
  bubble.innerHTML = formatMarkdown(text);

  messageDiv.appendChild(avatar);
  messageDiv.appendChild(bubble);

  chatMessages.appendChild(messageDiv);
  scrollToChatBottom();
}

function scrollToChatBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Basic markdown parser for bold, bullet points, numbers, and paragraphs.
 * Sanitizes raw HTML to protect against XSS.
 */
function formatMarkdown(rawText) {
  if (!rawText) return '';

  // Escape HTML entities
  let safe = rawText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Convert bold **text** -> <strong>text</strong>
  safe = safe.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Convert `code` -> <code>code</code>
  safe = safe.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Split lines
  const lines = safe.split('\n');
  let html = '';
  let inList = false;

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
      if (!inList) {
        html += '<ul>';
        inList = true;
      }
      html += `<li>${trimmed.substring(2)}</li>`;
    } else if (/^\d+\.\s/.test(trimmed)) {
      if (!inList) {
        html += '<ol>';
        inList = true;
      }
      html += `<li>${trimmed.replace(/^\d+\.\s/, '')}</li>`;
    } else {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      if (trimmed) {
        html += `<p>${trimmed}</p>`;
      }
    }
  });

  if (inList) html += '</ul>';

  return html;
}
