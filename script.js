// Animations
window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { 
        document.getElementById('loader').style.display = 'none'; 
        document.getElementById('main-content').classList.add('site-ready'); 
    }, 2500);
});

// Navigation Logic
function openSheet(id) { 
    document.getElementById(id).classList.add('active'); 
}

function closeSheet(id) { 
    document.getElementById(id).classList.remove('active'); 
}
