// ─── LANGUAGE PACK (EN / HE) ─────────────────────────────────────────────────

const TRANSLATIONS = {
    en: {
        // Navbar
        'nav.title': 'Python Code Tester - Beny Karachun',
        'nav.course': '02340128 - מבוא למחשב שפת פייתון · Technion',
        'nav.tutoring': 'Available for Tutoring',

        // Tutorial
        'tutorial.title': 'How to Use This Tool',
        'tutorial.step1.title': 'Organize by Homework',
        'tutorial.step1.desc': 'Use the <strong>HW tabs</strong> at the top to manage different assignments. Click <code>+</code> to add more. Each HW tab has <strong>Question subtabs</strong> (Q1, Q2, ...) for individual questions.',
        'tutorial.step2.title': 'Upload Your Code',
        'tutorial.step2.desc': 'Drag & drop your <code>.py</code> file into the blue upload area, or click to browse. One Python file per question.',
        'tutorial.step3.title': 'Add Test Cases',
        'tutorial.step3.desc': 'Each test case needs an <strong>input</strong> and <strong>expected output</strong> <code>.txt</code> file. Drop them into the matching slots.',
        'tutorial.step4.title': 'Run & Compare',
        'tutorial.step4.desc': 'Hit <strong>Execute</strong> to run your code against all test cases. You\'ll see a <span class="text-success fw-bold">✓ Pass</span> or a <span class="text-danger fw-bold">✗ Diff</span> for each.',
        'tutorial.bulk.title': 'Bulk Upload',
        'tutorial.bulk.desc': 'Drop an entire <strong>folder</strong> or <strong>.zip</strong> file anywhere on the page! Files are auto-sorted into the right slots based on their name. Tabs & subtabs are created automatically.',
        'tutorial.bulk.link': '🧬 Wanna know how? It\'s not what you think!',
        'tutorial.privacy.title': '100% Private',
        'tutorial.privacy.desc': 'Everything runs <strong>locally in your browser</strong> via WebAssembly (Pyodide). No data is sent to any server. Your code never leaves your machine.',

        // Dynamic UI
        'ui.execute': 'Execute All',
        'ui.executing': 'Running...',
        'ui.clear': 'Clear All',
        'ui.codeUpload': 'Drop .py here or click to upload',
        'ui.inputDrop': 'Drop input file',
        'ui.expectedDrop': 'Drop expected output file',
        'ui.testCase': 'Test Case',
        'ui.input': 'Input',
        'ui.expectedOutput': 'Expected Output',
        'ui.output': 'Output',
        'ui.pass': 'Pass',
        'ui.diff': 'Diff',
        'ui.noOutput': 'No output',
        'ui.addQuestion': 'Add Question',
        'footer.disclaimer': 'This website is an independent student project and is not affiliated with, endorsed by, or associated with the Technion \u2013 Israel Institute of Technology.',
    },
    he: {
        // Navbar
        'nav.title': 'בודק קוד פייתון - בני קרצ׳ון',
        'nav.course': '02340128 - מבוא למחשב שפת פייתון · הטכניון',
        'nav.tutoring': 'זמין לשיעורים פרטיים',

        // Tutorial
        'tutorial.title': 'איך להשתמש בכלי',
        'tutorial.step1.title': 'ארגון לפי שיעורי בית',
        'tutorial.step1.desc': 'השתמשו ב<strong>לשוניות HW</strong> למעלה לניהול מטלות שונות. לחצו <code>+</code> להוספת עוד. לכל לשונית יש <strong>שאלות משנה</strong> (Q1, Q2, ...) לשאלות בודדות.',
        'tutorial.step2.title': 'העלאת הקוד',
        'tutorial.step2.desc': 'גררו ושחררו את קובץ ה-<code>.py</code> שלכם לאזור ההעלאה הכחול, או לחצו לעיון. קובץ פייתון אחד לכל שאלה.',
        'tutorial.step3.title': 'הוספת מקרי בדיקה',
        'tutorial.step3.desc': 'כל מקרה בדיקה צריך קובץ <strong>קלט</strong> וקובץ <strong>פלט צפוי</strong> בפורמט <code>.txt</code>. שחררו אותם למשבצות המתאימות.',
        'tutorial.step4.title': 'הרצה והשוואה',
        'tutorial.step4.desc': 'לחצו <strong>הרצה</strong> כדי להריץ את הקוד מול כל מקרי הבדיקה. תראו <span class="text-success fw-bold">✓ עבר</span> או <span class="text-danger fw-bold">✗ שונה</span> לכל אחד.',
        'tutorial.bulk.title': 'העלאה מרובה',
        'tutorial.bulk.desc': 'שחררו <strong>תיקייה</strong> שלמה או קובץ <strong>.zip</strong> על הדף! הקבצים ממוינים אוטומטית למשבצות הנכונות לפי השם. לשוניות ושאלות נוצרות אוטומטית.',
        'tutorial.bulk.link': '🧬 רוצים לדעת איך? זה לא מה שחשבתם!',
        'tutorial.privacy.title': '100% פרטי',
        'tutorial.privacy.desc': 'הכל רץ <strong>מקומית בדפדפן שלכם</strong> באמצעות WebAssembly (Pyodide). אין שליחת נתונים לשרת. הקוד שלכם לעולם לא עוזב את המחשב.',

        // Dynamic UI
        'ui.execute': 'הרץ הכל',
        'ui.executing': 'מריץ...',
        'ui.clear': 'נקה הכל',
        'ui.codeUpload': 'גררו קובץ .py לכאן או לחצו להעלאה',
        'ui.inputDrop': 'שחררו קובץ קלט',
        'ui.expectedDrop': 'שחררו קובץ פלט צפוי',
        'ui.testCase': 'מקרה בדיקה',
        'ui.input': 'קלט',
        'ui.expectedOutput': 'פלט צפוי',
        'ui.output': 'פלט',
        'ui.pass': 'עבר',
        'ui.diff': 'שונה',
        'ui.noOutput': 'אין פלט',
        'ui.addQuestion': 'הוסף שאלה',
        'footer.disclaimer': 'אתר זה הוא פרויקט סטודנטיאלי עצמאי ואינו משויך לטכניון – מכון טכנולוגי לישראל, אינו מאושר או קשור אליו.',
    }
};

let currentLang = localStorage.getItem('lang') || 'en';

function t(key) {
    return TRANSLATIONS[currentLang]?.[key] || TRANSLATIONS.en[key] || key;
}

function applyLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('lang', lang);

    // Set direction
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';

    // Update all elements with data-i18n attributes
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const translation = t(key);
        if (el.hasAttribute('data-i18n-html')) {
            el.innerHTML = translation;
        } else {
            el.textContent = translation;
        }
    });

    // Update toggle button
    const btn = document.getElementById('lang-toggle');
    if (btn) {
        btn.textContent = lang === 'en' ? 'עב' : 'EN';
        btn.title = lang === 'en' ? 'עברית' : 'English';
    }
}

function toggleLanguage() {
    applyLanguage(currentLang === 'en' ? 'he' : 'en');
}

// Apply on load
document.addEventListener('DOMContentLoaded', () => {
    applyLanguage(currentLang);
});
