window.addEventListener('DOMContentLoaded', () => {
    const loaderSound = new Audio('https://files.catbox.moe/qoyurk.mp3');
    
    // 1. Audio load hone ka wait karein taaki delay na ho
    loaderSound.addEventListener('canplaythrough', () => {
        // 2. Sound aur Animation ko ek saath trigger karein
        // Note: Browser autoplay block kar sakta hai
        loaderSound.play().catch(() => {
            console.log("Sound autoplay blocked. User interaction required.");
        });
    });

    // 3. Animation logic
    setTimeout(() => { 
        document.getElementById('loader').style.display = 'none'; 
        document.getElementById('main-content').classList.add('site-ready'); 
    }, 1950);
});

// Navigation Logic
function openSheet(id) { 
    document.getElementById(id).classList.add('active'); 
}

function closeSheet(id) { 
    document.getElementById(id).classList.remove('active'); 
}

function openUploadModal() { document.getElementById('uploadModal').style.display = 'flex'; }
function closeUploadModal() { 
    document.getElementById('uploadModal').style.display = 'none'; 
    document.getElementById('successModal').style.display = 'none'; 
}
function showSuccess() {
    document.getElementById('uploadModal').style.display = 'none';
    document.getElementById('successModal').style.display = 'flex';
}
function updateFileName() {
    const file = document.getElementById('fileInput').files[0];
    if(file) document.getElementById('fileNameDisplay').innerText = file.name;
}
