// DOM Elements
const sidebar = document.getElementById("sidebar");
const toggleSidebarBtn = document.getElementById("toggle-sidebar");
const showSidebarBtn = document.getElementById("show-sidebar");
const newChatBtn = document.getElementById("new-chat");
const conversationList = document.getElementById("conversation-list");
const chatContainer = document.getElementById("chat-container");
const messageInput = document.getElementById("message-input");
const sendMessageBtn = document.getElementById("send-message");
const modelSelect = document.getElementById("model-select");

// State
let currentConversationId = null;
let conversations = [];
let isLoading = false;

// Functions
async function fetchConversations() {
  try {
    const response = await fetch("/api/conversations");
    const data = await response.json();
    conversations = data.conversations || [];
    renderConversationList();
  } catch (error) {
    console.error("Error fetching conversations:", error);
  }
}

async function fetchConversation(conversationId) {
  try {
    const response = await fetch(`/api/conversations/${conversationId}`);
    const data = await response.json();
    return data.conversation;
  } catch (error) {
    console.error("Error fetching conversation:", error);
    return null;
  }
}

async function deleteConversation(conversationId) {
  try {
    await fetch(`/api/conversations/${conversationId}`, {
      method: "DELETE",
    });
    fetchConversations();
    if (currentConversationId === conversationId) {
      currentConversationId = null;
      chatContainer.innerHTML = getWelcomeHTML();
    }
  } catch (error) {
    console.error("Error deleting conversation:", error);
  }
}

function renderConversationList() {
  conversationList.innerHTML = "";

  if (conversations.length === 0) {
    conversationList.innerHTML =
      '<li class="text-gray-500 text-sm italic">No conversations yet</li>';
    return;
  }

  conversations.forEach((conversation) => {
    const li = document.createElement("li");
    li.className = `conversation-item ${
      conversation._id === currentConversationId ? "active" : ""
    }`;
    li.innerHTML = `
      <div class="flex-1 truncate">
        <i class="fas fa-comment-alt mr-2"></i>
        ${conversation.title}
      </div>
      <button class="delete-conversation text-gray-400 hover:text-gray-200" data-id="${conversation._id}">
        <i class="fas fa-trash"></i>
      </button>
    `;
    li.addEventListener("click", (e) => {
      if (!e.target.closest(".delete-conversation")) {
        loadConversation(conversation._id);
      }
    });
    conversationList.appendChild(li);
  });

  // Add event listeners for delete buttons
  document.querySelectorAll(".delete-conversation").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-id");
      if (confirm("Are you sure you want to delete this conversation?")) {
        deleteConversation(id);
      }
    });
  });
}

async function loadConversation(conversationId) {
  currentConversationId = conversationId;
  renderConversationList();

  const conversation = await fetchConversation(conversationId);
  if (!conversation) return;

  chatContainer.innerHTML = "";
  conversation.messages.forEach((message) => {
    appendMessage(message.role, message.content);
  });

  // Set the model for this conversation
  if (conversation.model) {
    modelSelect.value = conversation.model;
  }

  // Scroll to bottom
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function appendMessage(role, content, usedContext) {
  const messageDiv = document.createElement("div");
  messageDiv.className = `message ${role}-message relative`;

  const avatar = document.createElement("div");
  avatar.className = `${role}-avatar`;
  avatar.innerHTML = role === "user" ? "U" : "A";

  const contentDiv = document.createElement("div");
  contentDiv.className = "message-content";
  contentDiv.innerHTML = formatMessageContent(content);

  if (usedContext) {
    const contextDiv = document.createElement("div");
    contextDiv.className = "context-indicator";
    contextDiv.innerHTML = "Context used";
    contentDiv.appendChild(contextDiv);
  }

  messageDiv.appendChild(avatar);
  messageDiv.appendChild(contentDiv);
  chatContainer.appendChild(messageDiv);

  // Scroll to bottom
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function formatMessageContent(content) {
  // Convert markdown-like syntax
  // This is a simple version - consider using a markdown library for more robust formatting

  // Code blocks
  content = content.replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>");

  // Inline code
  content = content.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Bold
  content = content.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  // Italic
  content = content.replace(/\*(.*?)\*/g, "<em>$1</em>");

  // Lists (simple version)
  content = content.replace(/^\s*-\s+(.*)/gm, "<li>$1</li>");
  content = content.replace(/(<li>.*<\/li>)/s, "<ul>$1</ul>");

  // Line breaks
  content = content.replace(/\n/g, "<br>");

  return content;
}

function getWelcomeHTML() {
  return `
    <div class="text-center text-gray-500 my-10">
      <h2 class="text-2xl font-bold mb-2">Ollama Chat</h2>
      <p class="mb-4">Powered by your local LLMs</p>
    </div>
  `;
}

async function sendMessage() {
  const query = messageInput.value.trim();
  if (!query || isLoading) return;

  // Clear input
  messageInput.value = "";

  // Add user message to chat
  appendMessage("user", query);

  // Show loading indicator
  isLoading = true;
  const loadingDiv = document.createElement("div");
  loadingDiv.className = "message assistant-message relative";
  loadingDiv.innerHTML = `
    <div class="assistant-avatar">A</div>
    <div class="message-content">
      <div class="loading-dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  `;
  chatContainer.appendChild(loadingDiv);

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        conversationId: currentConversationId,
        model: modelSelect.value,
        useContext: true,
      }),
    });

    const data = await response.json();

    // Remove loading indicator
    chatContainer.removeChild(loadingDiv);

    // Add assistant response
    appendMessage("assistant", data.response, data.usedContext);

    // Update conversation ID if this was a new conversation
    if (!currentConversationId && data.conversationId) {
      currentConversationId = data.conversationId;
      await fetchConversations();
    }
  } catch (error) {
    console.error("Error sending message:", error);

    // Remove loading indicator and show error
    chatContainer.removeChild(loadingDiv);

    const errorDiv = document.createElement("div");
    errorDiv.className = "message assistant-message relative";
    errorDiv.innerHTML = `
      <div class="assistant-avatar">A</div>
      <div class="message-content text-red-500">
        <strong>Error:</strong> Failed to get a response. Please try again.
      </div>
    `;
    chatContainer.appendChild(errorDiv);
  } finally {
    isLoading = false;
  }
}

// Event Listeners
toggleSidebarBtn.addEventListener("click", () => {
  sidebar.classList.toggle("show");
});

showSidebarBtn.addEventListener("click", () => {
  sidebar.classList.add("show");
});

document.addEventListener("click", (e) => {
  // Close sidebar when clicking outside of it on mobile
  if (
    window.innerWidth < 1024 &&
    !sidebar.contains(e.target) &&
    !showSidebarBtn.contains(e.target)
  ) {
    sidebar.classList.remove("show");
  }
});

newChatBtn.addEventListener("click", () => {
  currentConversationId = null;
  chatContainer.innerHTML = getWelcomeHTML();

  // Unselect conversation in list
  document.querySelectorAll(".conversation-item").forEach((item) => {
    item.classList.remove("active");
  });
});

sendMessageBtn.addEventListener("click", sendMessage);

messageInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }

  // Auto-resize textarea
  setTimeout(() => {
    messageInput.style.height = "auto";
    messageInput.style.height = Math.min(messageInput.scrollHeight, 150) + "px";
  }, 0);
});

// Initial Setup
fetchConversations();

// Adjust textarea height on input
messageInput.addEventListener("input", () => {
  messageInput.style.height = "auto";
  messageInput.style.height = Math.min(messageInput.scrollHeight, 150) + "px";
});
