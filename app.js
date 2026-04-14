// ============================================================
//  CONFIG
// ============================================================
const apiKey = "METTRE API KEY";
const GEMINI_MODEL = "gemini-2.5-flash-preview-09-2025";


//  STATE

let library = JSON.parse(localStorage.getItem('study_library_v6')) || [];
let currentFile = null;
let generatedData = null;
let activeFilter = null;

let quizState = {
    currentIndex: 0,
    score: 0,
    answered: false,
    selectedOption: null
};

const subjects = ["Bloc 1", "SISR", "SLAM", "Cyber", "Maths", "CEJM", "CGE"];


//  INIT

window.onload = () => {
    renderSubjects();
    lucide.createIcons();
    showView('editor');

    // File drag & drop
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    dropZone.onclick = () => fileInput.click();
    fileInput.onchange = (e) => handleFile(e.target.files[0]);
};

//  SIDEBAR
function toggleSidebar(show) {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobile-overlay');
    if (show) {
        overlay.classList.remove('hidden');
        setTimeout(() => overlay.classList.add('opacity-100'), 10);
        sidebar.classList.remove('-translate-x-full');
    } else {
        overlay.classList.remove('opacity-100');
        sidebar.classList.add('-translate-x-full');
        setTimeout(() => overlay.classList.add('hidden'), 300);
    }
}


//  VIEWS

function showView(viewId) {
    toggleSidebar(false);

    ['view-editor', 'view-library', 'view-viewer'].forEach(id =>
        document.getElementById(id).classList.add('hidden')
    );
    document.getElementById('top-nav').classList.add('hidden');

    ['nav-editor', 'nav-library'].forEach(id => {
        document.getElementById(id).classList.remove('active', 'text-white');
        document.getElementById(id).classList.add('text-slate-600');
    });

    if (viewId === 'editor') {
        document.getElementById('view-editor').classList.remove('hidden');
        document.getElementById('nav-editor').classList.add('active', 'text-white');
        document.getElementById('nav-editor').classList.remove('text-slate-600');

    } else if (viewId === 'library') {
        document.getElementById('view-library').classList.remove('hidden');
        document.getElementById('nav-library').classList.add('active', 'text-white');
        document.getElementById('nav-library').classList.remove('text-slate-600');
        renderLibrary();

    } else if (viewId === 'viewer') {
        document.getElementById('view-viewer').classList.remove('hidden');
        document.getElementById('top-nav').classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    lucide.createIcons();
}


//  FILE HANDLING

function handleFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        currentFile = {
            base64: e.target.result.split(',')[1],
            mime: file.type,
            name: file.name
        };
        document.getElementById('filePreview').classList.remove('hidden');
        document.getElementById('fileNameDisplay').innerText = file.name;
        document.getElementById('dropZone').classList.add('hidden');
        document.getElementById('generateBtn').disabled = false;

        if (!document.getElementById('chapterTitle').value) {
            document.getElementById('chapterTitle').value = file.name.split('.')[0];
        }
    };
    reader.readAsDataURL(file);
}

function clearFile() {
    currentFile = null;
    document.getElementById('filePreview').classList.add('hidden');
    document.getElementById('dropZone').classList.remove('hidden');
    document.getElementById('generateBtn').disabled = true;
    document.getElementById('fileInput').value = '';
}


//  AI 

async function processAI() {
    const title   = document.getElementById('chapterTitle').value;
    const subject = document.getElementById('subjectSelect').value;

    if (!title) { showToast("Veuillez entrer un titre !", "error"); return; }

    document.getElementById('result-loading').classList.remove('hidden');
    document.getElementById('generateBtn').disabled = true;

    const prompt = `Tu es un tuteur expert pour le BTS SIO. 
Analyse le document fourni et crée une synthèse d'étude massive.
Structure JSON de réponse OBLIGATOIRE :
{
  "title": "Titre Pro",
  "lessonSummary": "Résumé synthétique du chapitre (Markdown)",
  "definitions": "Glossaire des termes techniques clés et leurs définitions (Markdown)",
  "content": "Développement détaillé des notions (Markdown)",
  "quiz": [
    { "question": "Question ?", "options": ["A", "B", "C", "D"], "correct": 0, "explain": "Explication pédagogique" }
  ]
}
RÈGLES :
- Le quiz DOIT contenir EXACTEMENT 20 questions variées.
- Les définitions doivent être claires.
- Utilise un ton pédagogique et pro.`;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: "Génère la fiche SIO complète avec résumé, glossaire et quiz de 20 questions en JSON." },
                            { inlineData: { mimeType: currentFile.mime, data: currentFile.base64 } }
                        ]
                    }],
                    systemInstruction: { parts: [{ text: prompt }] },
                    generationConfig: { responseMimeType: "application/json" }
                })
            }
        );

        const data     = await response.json();
        const jsonText = data.candidates[0].content.parts[0].text;
        const json     = JSON.parse(jsonText);

        generatedData = {
            ...json,
            id:      Date.now(),
            date:    new Date().toLocaleDateString('fr-FR'),
            subject,
            chapter: title
        };

        displaySheet(generatedData);
        showView('viewer');

    } catch (err) {
        console.error(err);
        showToast("Erreur lors de la génération. Réessayez.", "error");
    } finally {
        document.getElementById('result-loading').classList.add('hidden');
        document.getElementById('generateBtn').disabled = false;
    }
}


//  SHEET DISPLAY

function displaySheet(data) {
    document.getElementById('viewer-subject').innerText = data.subject;
    document.getElementById('viewer-title').innerText   = data.chapter;
    document.getElementById('viewer-date').innerText    = "Généré le " + data.date;

    document.getElementById('sheet-summary-box').innerHTML     = '<h2>Résumé de la leçon</h2>'     + formatMarkdown(data.lessonSummary);
    document.getElementById('sheet-definitions-box').innerHTML = '<h2>Glossaire & Définitions</h2>' + formatMarkdown(data.definitions);
    document.getElementById('sheet-content-box').innerHTML     = '<h2>Détails du cours</h2>'        + formatMarkdown(data.content);

    quizState = { currentIndex: 0, score: 0, answered: false, selectedOption: null };
    renderQuizStep();
    showViewerTab('sheet');
}

//  TABS (Viewer)

function showViewerTab(tab) {
    const isSheet = tab === 'sheet';
    document.getElementById('viewer-content-sheet').classList.toggle('hidden', !isSheet);
    document.getElementById('viewer-content-quiz').classList.toggle('hidden', isSheet);

    const btnS = document.getElementById('tab-sheet-btn');
    const btnQ = document.getElementById('tab-quiz-btn');
    const activeClass   = "flex-1 min-w-[120px] py-2.5 rounded-xl text-xs font-black transition-all bg-white shadow-sm text-indigo-600 uppercase";
    const inactiveClass = "flex-1 min-w-[120px] py-2.5 rounded-xl text-xs font-black transition-all text-slate-500 uppercase";

    btnS.className = isSheet ? activeClass : inactiveClass;
    btnQ.className = isSheet ? inactiveClass : activeClass;

    if (!isSheet) renderQuizStep();
}

//  QUIZ
function renderQuizStep() {
    const container = document.getElementById('quiz-question-card');
    const counter   = document.getElementById('quiz-counter');
    const progress  = document.getElementById('quiz-progress-bar');
    const questions = generatedData.quiz;
    const total     = questions.length;

    counter.innerText      = `Question ${quizState.currentIndex + 1} / ${total}`;
    progress.style.width   = `${((quizState.currentIndex + 1) / total) * 100}%`;

    if (quizState.currentIndex >= total) { renderQuizResults(); return; }

    const q = questions[quizState.currentIndex];

    container.innerHTML = `
        <div class="space-y-4 animate-fade">
            <div class="flex items-center gap-2 text-indigo-600 font-black text-[10px] uppercase tracking-widest">
                <i data-lucide="help-circle" class="w-4 h-4"></i> Question en cours
            </div>
            <p class="text-xl md:text-2xl font-extrabold text-slate-800 leading-tight">${q.question}</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${q.options.map((opt, i) => `
                <button onclick="handleQuizChoice(${i})"
                        class="quiz-option p-5 rounded-2xl border-2 border-slate-100 flex items-center gap-4 text-left group transition-all
                        ${quizState.answered
                            ? (i === q.correct
                                ? 'bg-green-50 border-green-500'
                                : (i === quizState.selectedOption ? 'bg-red-50 border-red-500' : 'opacity-40'))
                            : ''}">
                    <div class="w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs shrink-0
                        ${quizState.answered
                            ? (i === q.correct
                                ? 'bg-green-500 text-white'
                                : (i === quizState.selectedOption ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-400'))
                            : 'bg-slate-100 text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors'}">
                        ${String.fromCharCode(65 + i)}
                    </div>
                    <span class="font-bold text-slate-700 text-sm md:text-base">${opt}</span>
                </button>
            `).join('')}
        </div>

        ${quizState.answered ? `
        <div class="bg-indigo-50 border border-indigo-100 p-6 rounded-3xl animate-fade flex flex-col md:flex-row items-start md:items-center gap-6 justify-between">
            <div class="space-y-1">
                <p class="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Explication pédagogique</p>
                <p class="text-indigo-900 text-sm font-bold leading-relaxed">${q.explain}</p>
            </div>
            <button onclick="goToNextQuestion()" class="w-full md:w-auto bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black text-sm shadow-xl shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2">
                Question Suivante <i data-lucide="arrow-right" class="w-4 h-4"></i>
            </button>
        </div>
        ` : ''}
    `;

    lucide.createIcons();
}

function handleQuizChoice(index) {
    if (quizState.answered) return;
    const q = generatedData.quiz[quizState.currentIndex];
    quizState.answered       = true;
    quizState.selectedOption = index;

    if (index === q.correct) {
        quizState.score++;
        showToast("Bonne réponse ! +1", "success");
    } else {
        showToast("Mauvaise réponse", "error");
    }
    renderQuizStep();
}

function goToNextQuestion() {
    quizState.currentIndex++;
    quizState.answered       = false;
    quizState.selectedOption = null;
    renderQuizStep();
}

function renderQuizResults() {
    const container  = document.getElementById('quiz-question-card');
    const percentage = Math.round((quizState.score / generatedData.quiz.length) * 100);

    container.innerHTML = `
        <div class="text-center space-y-8 animate-fade py-8">
            <div class="w-24 h-24 bg-indigo-600 rounded-full flex items-center justify-center text-white mx-auto shadow-2xl shadow-indigo-200">
                <i data-lucide="award" class="w-12 h-12"></i>
            </div>
            <div class="space-y-2">
                <h3 class="text-3xl font-black text-slate-800">Quiz Terminé !</h3>
                <p class="text-slate-500 font-bold tracking-tight">Voici ton bilan pour ce chapitre SIO</p>
            </div>
            <div class="grid grid-cols-2 gap-4 max-w-sm mx-auto">
                <div class="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                    <p class="text-3xl font-black text-indigo-600">${quizState.score}/20</p>
                    <p class="text-[10px] font-bold text-slate-400 uppercase mt-1">Score</p>
                </div>
                <div class="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                    <p class="text-3xl font-black text-indigo-600">${percentage}%</p>
                    <p class="text-[10px] font-bold text-slate-400 uppercase mt-1">Réussite</p>
                </div>
            </div>
            <div class="flex flex-col gap-3 max-w-sm mx-auto">
                <button onclick="restartQuiz()" class="bg-indigo-600 text-white w-full py-4 rounded-2xl font-black shadow-lg hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2">
                    <i data-lucide="rotate-ccw" class="w-5 h-5"></i> Recommencer le quiz
                </button>
                <button onclick="showViewerTab('sheet')" class="bg-white border-2 border-slate-100 text-slate-600 w-full py-4 rounded-2xl font-black hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
                    <i data-lucide="book-open" class="w-5 h-5"></i> Relire la leçon
                </button>
            </div>
        </div>
    `;
    lucide.createIcons();
}

function restartQuiz() {
    quizState = { currentIndex: 0, score: 0, answered: false, selectedOption: null };
    renderQuizStep();
}

//  LIBRARY
function saveToLibrary() {
    if (!generatedData) return;
    if (library.some(i => i.id === generatedData.id)) {
        showToast("Déjà sauvegardé", "info");
        return;
    }
    library.unshift(generatedData);
    localStorage.setItem('study_library_v6', JSON.stringify(library));
    showToast("Sauvegardé ! Retrouvez cette fiche dans votre bibliothèque.");
    renderSubjects();
}

function filterBySubject(subj) {
    activeFilter = subj;
    renderSubjects();
    showView('library');
}

function renderLibrary() {
    const grid     = document.getElementById('library-grid');
    const status   = document.getElementById('library-status');
    const filtered = activeFilter ? library.filter(i => i.subject === activeFilter) : library;

    status.innerText = activeFilter
        ? `Fiches pour : ${activeFilter}`
        : "Toutes vos fiches enregistrées.";

    if (filtered.length === 0) {
        grid.innerHTML = `<div class="col-span-full py-20 text-center font-bold text-slate-300">Aucun document trouvé.</div>`;
        return;
    }

    grid.innerHTML = filtered.map((item) => `
        <div class="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl transition-all flex flex-col justify-between h-full group">
            <div>
                <div class="flex justify-between items-start mb-6">
                    <span class="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">${item.subject}</span>
                    <button onclick="event.stopPropagation(); deleteItem(${item.id})" class="text-slate-200 hover:text-red-500 transition-colors">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
                <h4 class="text-lg md:text-xl font-black text-slate-800 mb-2 leading-tight">${item.chapter}</h4>
                <p class="text-[10px] text-slate-400 font-bold uppercase mb-8 italic">Généré le ${item.date}</p>
            </div>
            <button onclick="openFromLibrary(${library.indexOf(item)})" class="w-full py-4 bg-slate-50 text-indigo-600 rounded-2xl text-xs md:text-sm font-black hover:bg-indigo-600 hover:text-white transition-all shadow-sm uppercase tracking-widest">
                Voir la fiche
            </button>
        </div>
    `).join('');

    lucide.createIcons();
}

function openFromLibrary(idx) {
    generatedData = library[idx];
    displaySheet(generatedData);
    showView('viewer');
}

function deleteItem(id) {
    library = library.filter(i => i.id !== id);
    localStorage.setItem('study_library_v6', JSON.stringify(library));
    renderLibrary();
    renderSubjects();
    showToast("Document supprimé", "info");
}

function renderSubjects() {
    const list = document.getElementById('subject-list');
    list.innerHTML = subjects.map(s => {
        const count    = library.filter(f => f.subject === s).length;
        const isActive = activeFilter === s;
        return `
            <button onclick="filterBySubject('${s}')" class="w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${isActive ? 'subject-item active' : 'text-slate-500 hover:bg-slate-50'}">
                <span>${s}</span>
                <span class="bg-slate-100 text-slate-400 px-2 py-0.5 rounded-lg text-[9px]">${count}</span>
            </button>`;
    }).join('');
}

// ============================================================
//  TOAST
// ============================================================
function showToast(msg, type = "success") {
    const toast    = document.getElementById('toast');
    const iconBox  = document.getElementById('toast-icon-box');
    document.getElementById('toastMsg').innerText = msg;

    iconBox.className = type === 'error'
        ? 'bg-red-500 p-1 rounded-lg shrink-0'
        : 'bg-indigo-500 p-1 rounded-lg shrink-0';

    toast.classList.remove('translate-y-20', 'opacity-0', 'pointer-events-none');
    setTimeout(() =>
        toast.classList.add('translate-y-20', 'opacity-0', 'pointer-events-none'), 3000
    );
}

// ============================================================
//  MARKDOWN FORMATTER
// ============================================================
function formatMarkdown(md) {
    if (!md) return "";
    return md
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim,  '<h2>$1</h2>')
        .replace(/^# (.*$)/gim,   '<h1>$1</h1>')
        .replace(/^\* (.*$)/gim,  '<li>$1</li>')
        .replace(/^\- (.*$)/gim,  '<li>$1</li>')
        .replace(/^\> (.*$)/gim,  '<blockquote>$1</blockquote>')
        .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
        .replace(/`(.*?)`/gim,    '<code>$1</code>')
        .replace(/\n\n/gim,       '<p></p>')
        .replace(/\n/gim,         '<br>');
}
