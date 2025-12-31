// ===============================
// Claude Code History Viewer - JavaScript
// ===============================

const ICONS = {
  project: `<path d="M1.75 1A1.75 1.75 0 0 0 0 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0 0 16 13.25v-8.5A1.75 1.75 0 0 0 14.25 3H7.5a.25.25 0 0 1-.2-.1l-.9-1.2C6.07 1.22 5.55 1 5 1H1.75Z"/>`,
  conversation: `<path fill-rule="evenodd" d="M1.75 2.5a.75.75 0 0 0 0 1.5h10.5a.75.75 0 0 0 0-1.5H1.75Zm0 5a.75.75 0 0 0 0 1.5h6a.75.75 0 0 0 0-1.5h-6ZM.5 15.5l3-3h10.75a1.75 1.75 0 0 0 1.75-1.75v-9A1.75 1.75 0 0 0 14.25 0H1.75A1.75 1.75 0 0 0 0 1.75v13.75Z"/>`,
  message: `<path fill-rule="evenodd" d="M0 3.75C0 2.784.784 2 1.75 2h12.5c.966 0 1.75.784 1.75 1.75v8.5A1.75 1.75 0 0 1 14.25 14H1.75A1.75 1.75 0 0 1 0 12.25v-8.5Zm1.75-.25a.25.25 0 0 0-.25.25v8.5c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25v-8.5a.25.25 0 0 0-.25-.25H1.75ZM3.5 6.25a.75.75 0 0 1 .75-.75h7a.75.75 0 0 1 0 1.5h-7a.75.75 0 0 1-.75-.75Zm.75 2.25a.75.75 0 0 0 0 1.5h4a.75.75 0 0 0 0-1.5h-4Z"/>`,
  error: `<path fill-rule="evenodd" d="M8.22 1.754a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368L7.78 1.754ZM10.5 1.5a1.75 1.75 0 0 0-3 0L1.418 12.875A1.75 1.75 0 0 0 2.918 15h10.164a1.75 1.75 0 0 0 1.5-2.125L8.78 1.754ZM9 10.25a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0v2.5Zm-.75 3.25a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"/>`,
  calendar: `<path d="M4.75 0a.75.75 0 0 1 .75.75V2h5V.75a.75.75 0 0 1 1.5 0V2h1.25c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0 1 14.25 16H1.75A1.75 1.75 0 0 1 0 14.25V3.75C0 2.784.784 2 1.75 2H3V.75A.75.75 0 0 1 3.75 0h1ZM1.5 3.75v10.5c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25V3.75a.25.25 0 0 0-.25-.25H1.75a.25.25 0 0 0-.25.25Z"/><path d="M4 7h2v2H4V7zm4 0h2v2H8V7z"/>`,
  search: `<path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>`,
  empty_box: `<path d="M1.75 1h12.5c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0 1 14.25 15H1.75A1.75 1.75 0 0 1 0 13.25V2.75C0 1.784.784 1 1.75 1ZM1.5 2.75v10.5c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25V2.75a.25.25 0 0 0-.25-.25H1.75a.25.25 0 0 0-.25.25ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"/>`,
  empty_search: `<path d="M8 1.5c-2.363 0-4.375.925-5.634 2.36-.984 1.12-1.476 2.542-1.32 4.028.012.12.06.568.16.955.053.203.156.537.349.866.243.415.625.751 1.135.751.749 0 1.26-.64 1.34-1.386.035-.334.08-.757.136-1.194.11-.873.26-1.95.508-2.74.26-.828.66-1.488 1.28-1.897.645-.425 1.468-.578 2.446-.432 1.077.16 1.836.77 2.27 1.586.397.748.512 1.627.42 2.453-.15 1.347-.8 2.69-2.09 3.45-.765.442-1.33 1.124-1.665 1.914-.31.733-.39 1.517-.295 2.238H7.5a.75.75 0 0 0 0 1.5h1a.75.75 0 0 0 .75-.75v-.058c0-.496.076-.97.27-1.38.19-.4.48-.76.89-.99.87-.503 1.32-1.424 1.42-2.32.06-.548-.01-1.107-.25-1.557-.24-.452-.62-.79-1.2-.877-.63-.094-1.04.02-1.3.19-.22.15-.41.41-.55.86-.17.55-.31 1.43-.41 2.21-.06.44-.11.87-.15 1.21-.14 1.3-1.23 2.39-2.7 2.39-1.13 0-1.88-.74-2.27-1.41-.26-.44-.38-.87-.45-1.12-.12-.48-.18-.98-.19-1.11-.19-1.84.44-3.62 1.68-5.04C3.75 2.54 6.2 1.5 9 1.5c2.9 0 5.19 1.38 6.54 3.46 1.31 2.02 1.53 4.69.46 7.27-.81 1.96-2.36 3.62-4.38 4.72-1.56.85-3.38 1.3-5.32 1.3a.75.75 0 0 0 0 1.5c2.18 0 4.23-.51 6.01-1.49 2.31-1.26 4.1-3.19 5.05-5.5 1.27-3.08.98-6.31-.61-8.76C15.42 2.95 12.54 1.5 9 1.5Z"/>`,
  info: `<path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm7.5 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"/>`,
  time: `<path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5Z"/><path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16Zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"/>`,
  copy: `<path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 15h-7.5A1.75 1.75 0 0 1 0 13.25Z"/><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/>`,
  check: `<path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/>`
};

function getIcon(name, size = 14) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="currentColor">${ICONS[name] || ''}</svg>`;
}


class HistoryViewer {
  constructor() {
    this.currentProject = null;
    this.currentConversation = null;
    this.projects = [];
    this.searchResults = [];
    this.currentTheme = localStorage.getItem("theme") || "dark";
    this.currentSource = localStorage.getItem("source") || "claude";
    this.autoRefreshInterval = null;
    this.autoRefreshEnabled = true; // 暂时禁用自动刷新
    this.isRefreshing = false;
    this.searchDebounceTimer = null;
    this.AUTO_REFRESH_INTERVAL = 120000; // 2 minutes
    this.SEARCH_DEBOUNCE_DELAY = 300;

    this.init();
  }

  async init() {
    // 绑定 DOM 元素
    this.elements = {
      projectsList: document.getElementById("projectsList"),
      conversationsList: document.getElementById("conversationsList"),
      conversationDetail: document.getElementById("conversationDetail"),
      searchInput: document.getElementById("searchInput"),
      searchModalResults: document.getElementById("searchModalResults"),
      currentProjectTitle: document.getElementById("currentProjectTitle"),
      conversationCount: document.getElementById("conversationCount"),
      conversationMeta: document.getElementById("conversationMeta"),
      backBtn: document.getElementById("backBtn"),
      clearSearchBtn: document.getElementById("clearSearchBtn"),
      stats: document.getElementById("stats"),
      listView: document.getElementById("listView"),
      detailView: document.getElementById("detailView"),
      searchView: document.getElementById("searchView"),
      themeToggle: document.getElementById("themeToggle"),
      openSearchBtn: document.getElementById("openSearchBtn"),
      closeSearchBtn: document.getElementById("closeSearchBtn"),
      searchModal: document.getElementById("searchModal"),
      sourceToggle: document.getElementById("sourceToggle"),
      sourceDropdown: document.getElementById("sourceDropdown"),
      sourceTitle: document.getElementById("sourceTitle"),
    };

    // 绑定事件
    this.bindEvents();

    // 应用保存的主题和数据源
    this.applyTheme(this.currentTheme);
    this.applySource(this.currentSource);

    // 加载数据
    await this.loadInitialData();

    // 启动自动刷新（30秒）
    this.startAutoRefresh();

    // 页面卸载时清理定时器
    window.addEventListener("beforeunload", () => this.cleanup());
  }

  cleanup() {
    // 清理自动刷新定时器
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
      this.autoRefreshInterval = null;
    }
    // 清理搜索防抖定时器
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = null;
    }
  }

  bindEvents() {
    // 搜索模态框控制
    this.elements.openSearchBtn.addEventListener("click", () =>
      this.toggleSearchModal(true),
    );
    this.elements.closeSearchBtn.addEventListener("click", () =>
      this.toggleSearchModal(false),
    );
    this.elements.searchModal.addEventListener("click", (e) => {
      if (e.target === this.elements.searchModal) this.toggleSearchModal(false);
    });
    this.elements.searchInput.addEventListener("input", () => {
      // 清除之前的防抖定时器
      if (this.searchDebounceTimer) {
        clearTimeout(this.searchDebounceTimer);
      }
      // 设置新的防抖定时器
      this.searchDebounceTimer = setTimeout(() => {
        this.handleSearch();
      }, this.SEARCH_DEBOUNCE_DELAY);
    });
    this.elements.searchInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        if (this.searchDebounceTimer) {
          clearTimeout(this.searchDebounceTimer);
        }
        this.handleSearch();
      }
    });

    // 返回按钮
    this.elements.backBtn.addEventListener("click", () =>
      this.showView("list"),
    );

    // 清除搜索
    this.elements.clearSearchBtn.addEventListener("click", () => {
      this.elements.searchInput.value = "";
      this.showView("list");
    });

    // 主题切换
    this.elements.themeToggle.addEventListener("click", () =>
      this.toggleTheme(),
    );

    // 数据源切换
    this.elements.sourceToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggleSourceDropdown();
    });

    // 数据源选择
    this.elements.sourceDropdown
      .querySelectorAll(".source-item")
      .forEach((item) => {
        item.addEventListener("click", (e) => {
          const source = e.currentTarget.dataset.source;
          this.selectSource(source);
        });
      });

    // 点击外部关闭下拉菜单
    document.addEventListener("click", (e) => {
      if (
        !this.elements.sourceToggle.contains(e.target) &&
        !this.elements.sourceDropdown.contains(e.target)
      ) {
        this.closeSourceDropdown();
      }
    });

    // 键盘快捷键
    document.addEventListener("keydown", (e) => this.handleKeyboard(e));
  }

  // ===============================
  // 主题管理
  // ===============================
  applyTheme(theme) {
    this.currentTheme = theme;
    document.documentElement.setAttribute("data-theme", theme);

    // 更新 highlight.js 主题
    const darkTheme = document.getElementById("hljs-dark-theme");
    const lightTheme = document.getElementById("hljs-light-theme");

    if (theme === "light") {
      darkTheme.setAttribute("disabled", "");
      lightTheme.removeAttribute("disabled");
    } else {
      darkTheme.removeAttribute("disabled");
      lightTheme.setAttribute("disabled", "");
    }

    // 更新图标
    this.updateThemeIcon();
  }

  toggleTheme() {
    const newTheme = this.currentTheme === "dark" ? "light" : "dark";
    this.applyTheme(newTheme);
    localStorage.setItem("theme", newTheme);
  }

  updateThemeIcon() {
    const sunIcon = this.elements.themeToggle.querySelector(".theme-icon-sun");
    const moonIcon =
      this.elements.themeToggle.querySelector(".theme-icon-moon");

    if (this.currentTheme === "light") {
      sunIcon.style.display = "none";
      moonIcon.style.display = "block";
    } else {
      sunIcon.style.display = "block";
      moonIcon.style.display = "none";
    }
  }

  // ===============================
  // 数据源管理
  // ===============================
  applySource(source) {
    this.currentSource = source;

    const sourceNames = {
      claude: "Claude History",
      codex: "Codex History",
      gemini: "Gemini History",
    };

    this.elements.sourceTitle.textContent = sourceNames[source];

    // 更新选中状态
    this.elements.sourceDropdown
      .querySelectorAll(".source-item")
      .forEach((item) => {
        item.classList.toggle("selected", item.dataset.source === source);
      });

    // 保存到 localStorage
    localStorage.setItem("source", source);
  }

  toggleSourceDropdown() {
    const isOpen = this.elements.sourceDropdown.classList.contains("show");
    if (isOpen) {
      this.closeSourceDropdown();
    } else {
      this.openSourceDropdown();
    }
  }

  openSourceDropdown() {
    this.elements.sourceDropdown.classList.add("show");
    this.elements.sourceToggle.classList.add("active");
  }

  closeSourceDropdown() {
    this.elements.sourceDropdown.classList.remove("show");
    this.elements.sourceToggle.classList.remove("active");
  }

  async selectSource(source) {
    if (source === this.currentSource) {
      this.closeSourceDropdown();
      return;
    }

    this.currentSource = source;
    this.applySource(source);
    this.closeSourceDropdown();

    // 重新加载数据
    await this.loadInitialData();
  }

  async loadInitialData() {
    try {
      // 加载项目列表（带 source 参数）
      const projectsRes = await fetch(
        `/api/projects?source=${this.currentSource}`,
      );
      const projectsData = await projectsRes.json();
      this.projects = projectsData.projects;

      // 加载统计信息（带 source 参数）
      const statsRes = await fetch(`/api/stats?source=${this.currentSource}`);
      const statsData = await statsRes.json();

      // 渲染项目列表
      this.renderProjects();
      this.renderStats(statsData);

      // 默认加载第一个项目（如果不是错误状态且有项目）
      if (this.projects.length > 0 && !this.projects[0].name.startsWith("Error:")) {
        this.selectProject(this.projects[0].name);
      }
    } catch (error) {
      console.error("Failed to load data:", error);
    }
  }

  renderProjects() {
    // 检查是否有错误
    if (
      this.projects.length > 0 &&
      this.projects[0].name.startsWith("Error:")
    ) {
      this.elements.projectsList.innerHTML = `
        <div class="empty-state">
          ${getIcon('error', 16)}
          <h3>${this.escapeHtml(this.projects[0].name)}</h3>
          <p>The data directory for this source may not exist.</p>
        </div>
      `;
      return;
    }

    // 检查是否为空
    if (this.projects.length === 0) {
      this.elements.projectsList.innerHTML = `
        <div class="empty-state">
          ${getIcon('empty_box', 16)}
          <h3>No projects found</h3>
          <p>No conversation history for this source.</p>
        </div>
      `;
      return;
    }

    this.elements.projectsList.innerHTML = this.projects
      .map(
        (project) => `
            <div class="project-item" data-project="${this.escapeHtml(project.name)}">
                <span class="project-name">${this.escapeHtml(project.name)}</span>
                <span class="project-count">${project.conversation_count}</span>
            </div>
        `,
      )
      .join("");

    // 绑定项目点击事件
    this.elements.projectsList
      .querySelectorAll(".project-item")
      .forEach((item) => {
        item.addEventListener("click", () => {
          const projectName = item.dataset.project;
          this.selectProject(projectName);
        });
      });
  }

  renderStats(stats) {
    // 处理错误情况
    if (stats.error) {
      this.elements.stats.innerHTML = `
        <span style="color: var(--accent-red);">
          ${getIcon('error', 14)}
          Data unavailable
        </span>
      `;
      return;
    }

    this.elements.stats.innerHTML = `
            <span>
                ${getIcon('project', 14)}
                ${stats.projects_count} projects
            </span>
            <span>
                ${getIcon('conversation', 14)}
                ${stats.conversations_count} conversations
            </span>
            <span>
                ${getIcon('message', 14)}
                ${stats.messages_count} messages
            </span>
        `;
  }

  async selectProject(projectName) {
    this.currentProject = projectName;

    // 更新项目选中状态
    this.elements.projectsList
      .querySelectorAll(".project-item")
      .forEach((item) => {
        item.classList.toggle("active", item.dataset.project === projectName);
      });

    // 加载对话列表（带 source 参数）
    try {
      const res = await fetch(
        `/api/conversations?project=${encodeURIComponent(projectName)}&source=${this.currentSource}`,
      );
      const data = await res.json();

      this.elements.currentProjectTitle.textContent = projectName;
      this.elements.conversationCount.textContent = `${data.total} conversations`;

      this.renderConversations(data.conversations);
      this.showView("list");
    } catch (error) {
      console.error("Failed to load conversations:", error);
    }
  }

  renderConversations(conversations) {
    if (conversations.length === 0) {
      this.elements.conversationsList.innerHTML = `
                <div class="empty-state">
                    ${getIcon('empty_search', 16)}
                    <h3>No conversations found</h3>
                    <p>This project has no conversations yet.</p>
                </div>
            `;
      return;
    }

    this.elements.conversationsList.innerHTML = conversations
      .map(
        (conv) => `
            <div class="conversation-item" data-session="${this.escapeHtml(conv.session_id)}">
                <div class="conversation-title">${this.escapeHtml(conv.title)}</div>
                <div class="conversation-meta">
                    <span class="meta-item">
                        ${getIcon('conversation', 12)}
                        ${conv.message_count} messages
                    </span>
                    <span class="meta-item">
                        ${getIcon('calendar', 12)}
                        ${this.escapeHtml(conv.date)}
                    </span>
                </div>
            </div>
        `,
      )
      .join("");

    // 绑定对话点击事件
    this.elements.conversationsList
      .querySelectorAll(".conversation-item")
      .forEach((item) => {
        item.addEventListener("click", () => {
          const sessionId = item.dataset.session;
          this.loadConversationDetail(sessionId);
        });
      });
  }

  async loadConversationDetail(sessionId) {
    try {
      const res = await fetch(
        `/api/conversation/${sessionId}?project=${encodeURIComponent(this.currentProject)}&source=${this.currentSource}`,
      );
      const data = await res.json();

      if (data.error) {
        console.error(data.error);
        return;
      }

      this.currentConversation = data;
      this.renderConversationDetail(data);
      this.showView("detail");
    } catch (error) {
      console.error("Failed to load conversation detail:", error);
    }
  }

  renderConversationDetail(conversation) {
    const msgCount = conversation.message_count || (conversation.messages ? conversation.messages.length : 0);
    this.elements.conversationMeta.innerHTML = `
            <span>${msgCount} messages</span>
            <span>•</span>
            <span>${this.escapeHtml(conversation.project_path)}</span>
        `;

    this.elements.conversationDetail.innerHTML = `
            <div class="conversation-header">
                <h3>${this.escapeHtml(conversation.title)}</h3>
                <div class="conversation-info">
                    <span>
                        ${getIcon('info', 12)}
                        ID: ${conversation.session_id}
                    </span>
                    <span>
                        ${getIcon('time', 12)}
                        ${conversation.timestamp || "N/A"}
                    </span>
                </div>
            </div>
            <div class="messages-container">
                ${this.renderMessages(conversation.pairs)}
            </div>
        `;

    // 渲染完成后添加处理
    this.afterRenderDetail();
  }

  afterRenderDetail() {
    // 高亮代码
    this.elements.conversationDetail
      .querySelectorAll("pre code")
      .forEach((block) => {
        hljs.highlightElement(block);
        this.addCopyButton(block.parentNode);
      });
  }

  addCopyButton(preElement) {
    if (preElement.querySelector(".copy-btn")) return;

    const button = document.createElement("button");
    button.className = "copy-btn";
    button.innerHTML = getIcon('copy', 14);

    button.addEventListener("click", () => {
      const code = preElement.querySelector("code").innerText;
      navigator.clipboard.writeText(code).then(() => {
        button.innerHTML = getIcon('check', 14);
        button.classList.add("copied");
        setTimeout(() => {
          button.innerHTML = getIcon('copy', 14);
          button.classList.remove("copied");
        }, 2000);
      });
    });

    preElement.style.position = "relative";
    preElement.appendChild(button);
  }

  renderMessages(pairs) {
    return pairs
      .map((pair, index) => {
        let html = "";

        if (pair.user) {
          html += `
                    <div class="message user-message">
                        <div class="message-header">
                            <span class="message-role">User</span>
                            <span class="message-number">#${index + 1}</span>
                        </div>
                        <div class="message-content">${this.formatMessage(pair.user)}</div>
                    </div>
                `;
        }

        if (pair.assistant) {
          html += `
                    <div class="message assistant-message">
                        <div class="message-header">
                            <span class="message-role">Assistant</span>
                            ${pair.user ? `<span class="message-number">#${index + 1}</span>` : ""}
                        </div>
                        <div class="message-content">${this.formatMessage(pair.assistant)}</div>
                    </div>
                `;
        }

        return html;
      })
      .join("");
  }

  formatMessage(content) {
    // 检查是否包含代码块
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const inlineCodeRegex = /`([^`]+)`/g;

    let formatted = this.escapeHtml(content);

    // 处理代码块 - 需要再次转义HTML实体
    formatted = formatted.replace(codeBlockRegex, (match, lang, code) => {
      const language = this.escapeHtml(lang || "text");
      const escapedCode = code
        .trim()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      return `<pre><code class="language-${language}">${escapedCode}</code></pre>`;
    });

    // 处理内联代码
    formatted = formatted.replace(
      /&lt;code&gt;([^&]+)&lt;\/code&gt;/g,
      "<code>$1</code>",
    );

    // 处理段落
    formatted = formatted
      .split("\n\n")
      .map((para) => {
        if (para.includes("<pre>")) {
          return para;
        }
        return `<p>${para.replace(/\n/g, "<br>")}</p>`;
      })
      .join("");

    return formatted;
  }

  toggleSearchModal(show) {
    if (show) {
      this.elements.searchModal.classList.add("active");
      this.elements.searchInput.focus();
    } else {
      this.elements.searchModal.classList.remove("active");
      this.elements.searchInput.value = "";
      this.elements.searchModalResults.innerHTML = "";
    }
  }

  async handleSearch() {
    const query = this.elements.searchInput.value.trim();
    if (!query) {
      this.elements.searchModalResults.innerHTML = "";
      return;
    }

    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(query)}&source=${this.currentSource}`,
      );
      const data = await res.json();

      this.searchResults = data.results;
      this.renderSearchModalResults(data.results);
    } catch (error) {
      console.error("Search failed:", error);
    }
  }

  renderSearchModalResults(results) {
    if (results.length === 0) {
      this.elements.searchModalResults.innerHTML = ""; // Let CSS handle empty state
      return;
    }

    this.elements.searchModalResults.innerHTML = results
      .map(
        (result) => `
            <div class="conversation-item" data-project="${this.escapeHtml(result.project)}" data-session="${this.escapeHtml(result.session_id)}">
                <div class="conversation-title">${this.escapeHtml(result.title)}</div>
                <div class="conversation-meta">
                    <span class="meta-item">
                        ${getIcon('project', 12)}
                        ${this.escapeHtml(result.project)}
                    </span>
                    <span class="meta-item">
                        ${getIcon('calendar', 12)}
                        ${this.escapeHtml(result.date)}
                    </span>
                </div>
            </div>
        `,
      )
      .join("");

    // 绑定搜索结果点击事件
    this.elements.searchModalResults
      .querySelectorAll(".conversation-item")
      .forEach((item) => {
        item.addEventListener("click", () => {
          const project = item.dataset.project;
          const session = item.dataset.session;
          this.toggleSearchModal(false);
          this.currentProject = project;
          this.loadConversationDetail(session);
        });
      });
  }



  showView(view) {
    this.elements.listView.classList.remove("active");
    this.elements.detailView.classList.remove("active");
    this.elements.searchView.classList.remove("active");

    switch (view) {
      case "list":
        this.elements.listView.classList.add("active");
        break;
      case "detail":
        this.elements.detailView.classList.add("active");
        break;
      case "search":
        this.elements.searchView.classList.add("active");
        break;
    }
  }

  handleKeyboard(e) {
    // Ctrl + K - 打开搜索
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      this.toggleSearchModal(true);
      return;
    }

    // ESC - 关闭搜索或返回
    if (e.key === "Escape") {
      if (this.elements.searchModal.classList.contains("active")) {
        this.toggleSearchModal(false);
      } else {
        this.showView("list");
      }
      return;
    }

    // 已打开搜索模态框时不响应其他快捷键
    if (this.elements.searchModal.classList.contains("active")) return;

    // 只在列表视图响应快捷键
    if (!this.elements.listView.classList.contains("active")) return;

    // j/k - 导航项目
    if (e.key === "j" || e.key === "ArrowDown") {
      this.navigateProject(1);
    } else if (e.key === "k" || e.key === "ArrowUp") {
      this.navigateProject(-1);
    }
  }

  navigateProject(direction) {
    const activeProject = this.elements.projectsList.querySelector(
      ".project-item.active",
    );
    if (!activeProject && this.projects.length > 0) {
      this.selectProject(this.projects[0].name);
      return;
    }

    const items = Array.from(
      this.elements.projectsList.querySelectorAll(".project-item"),
    );
    const currentIndex = items.indexOf(activeProject);
    const newIndex = Math.max(
      0,
      Math.min(items.length - 1, currentIndex + direction),
    );

    if (items[newIndex]) {
      items[newIndex].click();
    }
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // ===============================
  // 自动刷新
  // ===============================
  startAutoRefresh() {
    // 每30秒自动刷新数据
    this.autoRefreshInterval = setInterval(() => {
      if (this.autoRefreshEnabled && !this.isRefreshing) {
        this.silentRefresh();
      }
    }, this.AUTO_REFRESH_INTERVAL);
  }

  stopAutoRefresh() {
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
      this.autoRefreshInterval = null;
    }
  }

  async silentRefresh() {
    if (this.isRefreshing) return;

    this.isRefreshing = true;
    this.showRefreshIndicator(true);

    try {
      const res = await fetch(`/api/reload?source=${this.currentSource}`, {
        method: "POST",
      });
      const data = await res.json();

      if (data.success) {
        // 只更新项目列表和统计信息，不影响当前视图
        const projectsRes = await fetch(
          `/api/projects?source=${this.currentSource}`,
        );
        const projectsData = await projectsRes.json();
        this.projects = projectsData.projects;
        this.renderProjects();

        // 更新统计信息
        const statsRes = await fetch(`/api/stats?source=${this.currentSource}`);
        const statsData = await statsRes.json();
        this.renderStats(statsData);

        // 显示刷新成功提示（静默，小图标）
        this.showRefreshNotification(data);
      }
    } catch (error) {
      console.error("Auto refresh failed:", error);
    } finally {
      this.isRefreshing = false;
      this.showRefreshIndicator(false);
    }
  }

  showRefreshIndicator(show) {
    // 在状态栏显示刷新指示器
    let indicator = document.getElementById("refreshIndicator");

    if (!indicator) {
      indicator = document.createElement("div");
      indicator.id = "refreshIndicator";
      indicator.className = "refresh-toast";
      document.body.appendChild(indicator);
    }

    if (show) {
      indicator.innerHTML = `
        <div class="refresh-content syncing">
          <svg class="spinner-small" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
          </svg>
          <span>Syncing history...</span>
        </div>
      `;
      indicator.classList.add("show");
    } else {
      indicator.innerHTML = `
        <div class="refresh-content success">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span>History Updated</span>
        </div>
      `;
      setTimeout(() => {
        indicator.classList.remove("show");
      }, 3000);
    }
  }

  showRefreshNotification(data) {
    // 在控制台显示数据完整性信息
    console.log("Data refreshed:", {
      projects: data.projects_count,
      conversations: data.conversations_count,
      messages: data.messages_count,
      files_on_disk: data.files_on_disk,
      loaded: data.conversations_loaded,
      skipped: data.skipped_count,
      complete: data.data_complete,
      load_time: data.load_time.toFixed(2) + "s",
    });

    // 如果有跳过的文件，显示详情
    if (data.skipped_count > 0) {
      console.warn("Skipped files:", data.skipped_files);
    }

    // 显示数据加载状态（总是显示）
    const notification = document.createElement("div");
    notification.className = "data-notification";

    // 根据数据完整性决定颜色
    let bgColor, textColor, icon;
    if (data.conversations_loaded === 0) {
      // 完全失败 - 红色
      bgColor = "var(--accent-red)";
      textColor = "#fff";
      icon = "❌";
    } else if (data.data_complete) {
      // 完全成功 - 绿色
      bgColor = "var(--accent-green)";
      textColor = "#fff";
      icon = "✅";
    } else {
      // 部分成功 - 浅蓝色
      bgColor = "var(--accent-info)";
      textColor = "#fff";
      icon = "ℹ️";
    }

    notification.style.cssText = `
        position: fixed;
        bottom: 10px;
        right: 10px;
        max-width: 400px;
        background: ${bgColor};
        color: ${textColor};
        padding: 12px 16px;
        border-radius: 6px;
        font-size: 12px;
        z-index: 1000;
        animation: slideIn 0.3s ease-out;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      `;

    let message = `${icon} `;
    if (data.conversations_loaded === 0) {
      message += `Data load failed<br>No conversations found`;
    } else {
      message += `Data loaded successfully<br>`;
      message += `Files: ${data.conversations_loaded}/${data.files_on_disk}`;
      if (data.skipped_count > 0) {
        message += `<br>Skipped: ${data.skipped_count}/${data.files_on_disk} (no messages)`;
      }
    }

    notification.innerHTML = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.opacity = "0";
      notification.style.transition = "opacity 0.3s";
      setTimeout(() => notification.remove(), 300);
    }, 8000);
  }
}

// 添加动画样式
const style = document.createElement("style");
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
`;
document.head.appendChild(style);

// 初始化应用
document.addEventListener("DOMContentLoaded", () => {
  new HistoryViewer();
});
