// script.js - Logic for Recuerdos de Noticias

const ANNOTATIONS_KEY = 'annotations';

let currentAnnotations = [];
let modal = null;
let addBtn, darkModeToggle, searchInput, categoryFilter, sortSelect, tagFilter, exportBtn, newsModal, newsForm, editId, newsTitle, newsImage, newsLink, newsCategory, newsTags, newsSummary, newsUrl, urlLoading, urlError, saveBtn, methodRadios;
let currentPage = 1;
const PAGE_SIZE = 10;

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', function() {
    // DOM elements
    addBtn = document.getElementById('addBtn');
    darkModeToggle = document.getElementById('darkModeToggle');
    searchInput = document.getElementById('searchInput');
    categoryFilter = document.getElementById('categoryFilter');
    sortSelect = document.getElementById('sortSelect');
    tagFilter = document.getElementById('tagFilter');
    exportBtn = document.getElementById('exportBtn');
    newsModal = new bootstrap.Modal(document.getElementById('newsModal'));
    newsForm = document.getElementById('newsForm');
    editId = document.getElementById('editId');
    newsTitle = document.getElementById('newsTitle');
    newsImage = document.getElementById('newsImage');
    newsLink = document.getElementById('newsLink');
    newsCategory = document.getElementById('newsCategory');
    newsTags = document.getElementById('newsTags');
    newsSummary = document.getElementById('newsSummary');
    newsUrl = document.getElementById('newsUrl');
    urlLoading = document.getElementById('urlLoading');
    urlError = document.getElementById('urlError');
    saveBtn = document.getElementById('saveBtn');

    methodRadios = document.querySelectorAll('input[name="method"]');

    // Load initial annotations
    currentAnnotations = loadAnnotations();
    renderAnnotations(currentAnnotations);
    updateCategoryFilter();

    // Event listeners
    addBtn.addEventListener('click', openAddModal);
    darkModeToggle.addEventListener('click', toggleDarkMode);
    searchInput.addEventListener('input', debounce(handleSearch, 300));
    categoryFilter.addEventListener('change', handleFilter);
    sortSelect.addEventListener('change', handleFilter);
    tagFilter.addEventListener('input', debounce(handleSearch, 300));
    exportBtn.addEventListener('click', exportAnnotations);
    newsUrl.addEventListener('input', debounce(extractFromUrl, 500));

    // Method radio change
    methodRadios.forEach(radio => {
        radio.addEventListener('change', toggleMethod);
    });

    saveBtn.addEventListener('click', handleSave);

    // Close modal reset
    document.getElementById('newsModal').addEventListener('hidden.bs.modal', resetForm);
});

// Load news from LocalStorage
function loadAnnotations() {
    const stored = localStorage.getItem(ANNOTATIONS_KEY);
    return stored ? JSON.parse(stored) : [];
}

// Save annotations to LocalStorage
function saveAnnotations(annotations) {
    localStorage.setItem(ANNOTATIONS_KEY, JSON.stringify(annotations));
    currentAnnotations = annotations;
}

// Render news cards
function renderAnnotations(annotationsToRender = currentAnnotations, searchTerm = '', selectedCategory = '', selectedTag = '', sortBy = 'date-desc') {
    const container = document.getElementById('cards-container');
    const noCards = document.getElementById('noCards');
    const pagination = document.getElementById('pagination');

    // Filter
    let filtered = annotationsToRender.filter(item =>
        (item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
         (item.summary && item.summary.toLowerCase().includes(searchTerm.toLowerCase()))) &&
        (!selectedCategory || item.category === selectedCategory) &&
        (!selectedTag || item.tags.some(t => t.toLowerCase().includes(selectedTag.toLowerCase())))
    );

    // Sort
    filtered.sort((a, b) => {
        if (sortBy === 'date-desc') return new Date(b.date) - new Date(a.date);
        if (sortBy === 'date-asc') return new Date(a.date) - new Date(b.date);
        if (sortBy === 'title-asc') return a.title.localeCompare(b.title);
        return 0;
    });

    // Clear
    container.innerHTML = '';

    currentPage = 1; // Reset page on filter

    if (filtered.length === 0) {
        noCards.classList.remove('d-none');
        pagination.classList.add('d-none');
        return;
    }

    noCards.classList.add('d-none');

    // Pagination
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    if (totalPages > 1) {
        pagination.classList.remove('d-none');
        let paginationHtml = '<ul class="pagination justify-content-center">';
        // Previous
        paginationHtml += `<li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="changePage(${currentPage - 1})">Anterior</a>
        </li>`;
        // Pages
        for (let i = 1; i <= totalPages; i++) {
            paginationHtml += `<li class="page-item ${i === currentPage ? 'active' : ''}">
                <a class="page-link" href="#" onclick="changePage(${i})">${i}</a>
            </li>`;
        }
        // Next
        paginationHtml += `<li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="changePage(${currentPage + 1})">Siguiente</a>
        </li>`;
        paginationHtml += '</ul>';
        pagination.innerHTML = paginationHtml;
    } else {
        pagination.classList.add('d-none');
    }

    // Paginate
    const start = (currentPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const paginated = filtered.slice(start, end);

    // Render cards (3 per row on md)
    paginated.forEach(item => {
        const card = createCardElement(item);
        container.appendChild(card);
    });

    // Load Twitter embeds if available
    if (typeof twttr !== 'undefined') {
        twttr.widgets.load(container);
    }
}

// Create card HTML element
function createCardElement(item) {
    const col = document.createElement('div');
    col.className = 'col-md-4 mb-4';
    
    const card = document.createElement('div');
    card.className = 'card annotation-card position-relative h-100';
    
    const categoryBadge = document.createElement('span');
    categoryBadge.className = 'badge bg-primary category-badge';
    categoryBadge.textContent = item.category || 'Sin categoría';
    
    const title = document.createElement('h5');
    title.className = 'card-title mt-2';
    title.textContent = item.title;
    
    const summaryPara = document.createElement('p');
    summaryPara.className = 'card-text summary mb-2 small';
    summaryPara.textContent = item.summary ? item.summary.substring(0, 100) + '...' : 'Sin resumen';
    
    const date = document.createElement('p');
    date.className = 'card-text date mb-2 small';
    date.textContent = `Fecha: ${new Date(item.date).toLocaleDateString('es-ES')}`;
    
    // Handle media elements based on platform
    let mediaElements = [];

    const isTikTok = item.link.includes('tiktok.com');
    const isYouTube = item.link.includes('youtube.com') || item.link.includes('youtu.be');
    const isTwitter = item.link.includes('twitter.com') || item.link.includes('x.com');

    // Add embeds for video/social platforms (no static image for videos)
    if (isTikTok) {
        console.log('TikTok card - link:', item.link, 'image:', item.image);
        const videoId = item.link.split('/').pop().split('?')[0];
        console.log('TikTok videoId:', videoId);
        const thumbUrl = item.image || `https://www.tiktok.com/thumb/v2/${videoId}?width=300&height=200`;
        console.log('TikTok thumbUrl:', thumbUrl);
        const img = document.createElement('img');
        img.src = thumbUrl;
        img.alt = item.title;
        img.className = 'card-img-top w-100';
        img.onerror = () => {
            console.log('TikTok image load failed, setting placeholder');
            img.src = 'https://via.placeholder.com/300x200/000000/FFFFFF?text=TikTok+Video';
        };
        mediaElements.push(img);
    } else if (isYouTube) {
        if (item.image) {
            const container = document.createElement('div');
            container.className = 'youtube-thumbnail-container mb-3 position-relative';
            container.innerHTML = `
                <img src="${item.image}" alt="${item.title}" class="card-img-top w-100" style="height: auto; max-height: 300px; object-fit: contain;">
                <a href="${item.link}" target="_blank" class="youtube-overlay">
                    <span class="play-icon">▶</span>
                </a>
            `;
            mediaElements.push(container);
        } else {
            // Fallback for YouTube without image
            const linkBtn = document.createElement('a');
            linkBtn.href = item.link;
            linkBtn.className = 'btn btn-primary';
            linkBtn.target = '_blank';
            linkBtn.textContent = 'Ver Video de YouTube';
            mediaElements.push(linkBtn);
        }
    } else if (isTwitter) {
        let tweetHref = item.link;
        if (tweetHref.includes('x.com')) {
            tweetHref = tweetHref.replace('https://x.com/', 'https://twitter.com/');
        }
        const embedDiv = document.createElement('div');
        embedDiv.className = 'mb-3';
        embedDiv.innerHTML = `<blockquote class="twitter-tweet"><a href="${tweetHref}"></a></blockquote>`;
        mediaElements.push(embedDiv);
    } else if (item.image) {
        // For general sites: add image
        const img = document.createElement('img');
        img.src = item.image;
        img.alt = item.title;
        img.className = 'card-img-top';
        mediaElements.push(img);
    } else {
        // Fallback placeholder
        const img = document.createElement('img');
        img.src = 'https://via.placeholder.com/300x200?text=No+Imagen';
        img.alt = item.title;
        img.className = 'card-img-top';
        mediaElements.push(img);
    }
    
    const cardBody = document.createElement('div');
    cardBody.className = 'card-body d-flex flex-column';
    
    const linkBtn = document.createElement('a');
    linkBtn.href = item.link;
    linkBtn.className = 'btn btn-primary btn-sm me-1';
    linkBtn.target = '_blank';
    linkBtn.textContent = 'Abrir Original';
    
    const shareBtn = document.createElement('button');
    shareBtn.className = 'btn btn-outline-info btn-sm me-1';
    shareBtn.textContent = 'Compartir';
    shareBtn.onclick = () => shareAnnotation(item);

    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-outline-secondary btn-sm me-1';
    editBtn.textContent = 'Editar';
    editBtn.onclick = () => openEditModal(item);
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-outline-danger btn-sm';
    deleteBtn.textContent = 'Eliminar';
    deleteBtn.onclick = () => deleteAnnotation(item.id);
    
    const btnGroup = document.createElement('div');
    btnGroup.appendChild(linkBtn);
    btnGroup.appendChild(shareBtn);
    btnGroup.appendChild(editBtn);
    btnGroup.appendChild(deleteBtn);
    
    cardBody.appendChild(title);
    cardBody.appendChild(summaryPara);
    cardBody.appendChild(date);
    cardBody.appendChild(btnGroup);
    
    card.appendChild(categoryBadge);
    mediaElements.forEach(el => card.appendChild(el));
    card.appendChild(cardBody);
    
    col.appendChild(card);
    return col;
}

// Open add modal
function openAddModal() {
    document.getElementById('newsModalLabel').textContent = 'Agregar Anotación';
    editId.value = '';
    resetForm();
    // Set URL mode as default for adding
    document.getElementById('url').checked = true;
    toggleMethod();
    newsModal.show();
}

// Open edit modal
function openEditModal(item) {
    document.getElementById('newsModalLabel').textContent = 'Editar Anotación';
    editId.value = item.id;
    newsTitle.value = item.title;
    newsImage.value = item.image || '';
    newsLink.value = item.link;
    newsCategory.value = item.category || '';
    newsTags.value = item.tags ? item.tags.join(', ') : '';
    newsSummary.value = item.summary || '';
    document.getElementById('manual').checked = true;
    toggleMethod(); // Show manual
    newsModal.show();
}

// Delete news
function deleteAnnotation(id) {
    if (confirm('¿Eliminar esta anotación?')) {
        currentAnnotations = currentAnnotations.filter(item => item.id !== id);
        saveAnnotations(currentAnnotations);
        renderAnnotations();
        updateCategoryFilter();
    }
}

// Handle save (add or edit)
function handleSave() {
    const title = newsTitle.value.trim();
    const link = newsLink.value.trim();
    const image = newsImage.value.trim();
    const category = newsCategory.value.trim();
    const tagsStr = newsTags.value.trim();
    const summary = newsSummary.value.trim();

    if (!title || !link) {
        alert('Título y enlace son requeridos.');
        return;
    }

    // Validate URL
    try {
        new URL(link);
    } catch {
        alert('Enlace inválido. Debe ser una URL completa (e.g., https://example.com).');
        return;
    }

    const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(t => t) : [];

    const annotationItem = {
        id: editId.value ? parseInt(editId.value) : Date.now(),
        title,
        image: image || null,
        link,
        summary: summary || null,
        category: category || null,
        tags,
        date: new Date().toISOString().split('T')[0]
    };

    let annotations = loadAnnotations();
    const isEdit = !!editId.value;

    if (isEdit) {
        const index = annotations.findIndex(item => item.id === annotationItem.id);
        if (index !== -1) {
            annotations[index] = annotationItem;
        }
    } else {
        annotations.push(annotationItem);
    }

    saveAnnotations(annotations);
    renderAnnotations();
    updateCategoryFilter();
    newsModal.hide();
    resetForm();
}

// Reset form
function resetForm() {
    newsForm.reset();
    editId.value = '';
    newsSummary.value = '';
    urlError.classList.add('d-none');
    urlLoading.classList.add('d-none');
    // Set URL mode as default
    document.getElementById('url').checked = true;
    toggleMethod();
}

// Toggle method sections
function toggleMethod() {
    const isManual = document.getElementById('manual').checked;
    document.getElementById('urlSection').classList.toggle('d-none', !isManual ? false : true);
    document.getElementById('manualSection').classList.toggle('d-none', isManual ? false : true);
    if (!isManual) {
        newsTitle.value = '';
        newsImage.value = '';
        newsSummary.value = '';
        newsLink.value = newsUrl.value; // Use URL as link
    }
}

// Extract from URL using proxy (bypasses CORS)
function extractFromUrl() {
    const url = newsUrl.value.trim();
    if (!url) return;

    if (document.getElementById('manual').checked) return;

    // Detect TikTok
    if (url.includes('tiktok.com')) {
        urlLoading.classList.remove('d-none');
        urlError.classList.add('d-none');
        const videoId = url.split('/').pop().split('?')[0];
        console.log('TikTok extraction - url:', url, 'videoId:', videoId);
        newsLink.value = url;
        // Use TikTok oEmbed for real data
        const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
        const proxyOembed = `https://api.allorigins.win/get?url=${encodeURIComponent(oembedUrl)}`;
        fetch(proxyOembed)
            .then(res => res.json())
            .then(data => {
                const oembedData = JSON.parse(data.contents);
                newsTitle.value = oembedData.title || 'TikTok Video';
                newsImage.value = oembedData.thumbnail_url || `https://www.tiktok.com/thumb/v2/${videoId}?width=300&height=200`;
                newsSummary.value = oembedData.description || 'Video de TikTok';
                console.log('TikTok oEmbed data:', oembedData);
                urlLoading.classList.add('d-none');
            })
            .catch(err => {
                console.error('TikTok oEmbed error:', err);
                newsTitle.value = 'TikTok Video';
                newsImage.value = `https://www.tiktok.com/thumb/v2/${videoId}?width=300&height=200`;
                newsSummary.value = 'Video de TikTok - error al extraer datos.';
                urlLoading.classList.add('d-none');
            });
        urlError.textContent = 'Datos extraídos de TikTok. Personaliza si es necesario.';
        urlError.classList.remove('d-none');
        // Stay in URL mode to preserve data
        return;
    }

    // Handle Twitter/X
    if (url.includes('twitter.com') || url.includes('x.com')) {
        urlLoading.classList.remove('d-none');
        urlError.classList.add('d-none');

        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;

        fetch(proxyUrl)
            .then(res => res.json())
            .then(data => {
                const parser = new DOMParser();
                const doc = parser.parseFromString(data.contents, 'text/html');
                let title = doc.querySelector('title')?.textContent?.trim() || '';
                let image = doc.querySelector('meta[property="og:image"]')?.getAttribute('content') ||
                            doc.querySelector('meta[name="twitter:image"]')?.getAttribute('content') || '';
                let summary = doc.querySelector('meta[name="description"]')?.getAttribute('content') ||
                              doc.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';

                // Clean title for Twitter
                title = title.replace(/ on Twitter| \/ X| - X\.com.*/, '').trim();

                newsLink.value = url;

                if (title) {
                    newsTitle.value = title;
                    newsImage.value = image || '';
                    newsSummary.value = summary || 'Post de X.com';
                } else {
                    const userMatch = url.match(/\/([^\/]+)\/status(?:es)?\/(\d+)/);
                    const user = userMatch ? `@${userMatch[1]}` : '@usuario';
                    newsTitle.value = `Post de X.com ${user}`;
                    newsImage.value = '';
                    newsSummary.value = 'Contenido del post de X.com';
                }

                urlLoading.classList.add('d-none');
            })
            .catch(err => {
                console.error('Extract error:', err);
                const userMatch = url.match(/\/([^\/]+)\/status(?:es)?\/(\d+)/);
                const user = userMatch ? `@${userMatch[1]}` : '@usuario';
                newsTitle.value = `Post de X.com ${user}`;
                newsImage.value = '';
                newsSummary.value = 'Post de X.com - el embed se mostrará en la tarjeta.';
                newsLink.value = url;
                urlError.textContent = 'No se pudo extraer detalles completos de X.com (posible restricción). El post se embedeará.';
                urlError.classList.remove('d-none');
                urlLoading.classList.add('d-none');
                // Do not switch to manual; keep fields populated for URL mode
            });
        return;
    }

    // Handle YouTube
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        urlLoading.classList.remove('d-none');
        urlError.classList.add('d-none');

        // Extract video ID
        let videoId = '';
        if (url.includes('youtu.be')) {
            videoId = url.split('youtu.be/')[1].split('?')[0].split('#')[0];
        } else {
            const match = url.match(/[?&]v=([^&#]*)/);
            videoId = match ? match[1] : '';
        }

        if (!videoId) {
            urlError.textContent = 'No se pudo extraer el ID del video de YouTube.';
            urlError.classList.remove('d-none');
            urlLoading.classList.add('d-none');
            return;
        }

        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
        const proxyOembed = `https://api.allorigins.win/get?url=${encodeURIComponent(oembedUrl)}`;

        fetch(proxyOembed)
            .then(res => res.json())
            .then(data => {
                const oembedData = JSON.parse(data.contents);
                newsTitle.value = oembedData.title;
                newsImage.value = oembedData.thumbnail_url;
                newsSummary.value = oembedData.description || `Video de YouTube: ${oembedData.author_name}`;
                newsLink.value = url;
                urlLoading.classList.add('d-none');
            })
            .catch(err => {
                console.error('YouTube oEmbed error:', err);
                newsTitle.value = 'Video de YouTube';
                newsImage.value = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
                newsSummary.value = 'Video de YouTube - el embed se mostrará en la tarjeta.';
                newsLink.value = url;
                urlError.textContent = 'No se pudo extraer detalles completos de YouTube. Usando fallback.';
                urlError.classList.remove('d-none');
                urlLoading.classList.add('d-none');
                // Keep in URL mode
            });
        return;
    }

    // General sites
    urlLoading.classList.remove('d-none');
    urlError.classList.add('d-none');

    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;

    fetch(proxyUrl)
        .then(res => res.json())
        .then(data => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(data.contents, 'text/html');
            let title = doc.querySelector('title')?.textContent?.trim() || '';
            let image = doc.querySelector('meta[property="og:image"]')?.getAttribute('content') ||
                        doc.querySelector('meta[name="twitter:image"]')?.getAttribute('content') ||
                        doc.querySelector('img')?.src || '';
            let summary = doc.querySelector('meta[name="description"]')?.getAttribute('content') ||
                          doc.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';

            // Clean title
            title = title.replace(/ - .*$/, ''); // Remove site suffix

            newsLink.value = url;

            if (!title) {
                urlError.textContent = 'No se encontró un título válido en la página. Por favor, ingresa manualmente.';
                urlError.classList.remove('d-none');
                newsImage.value = image;
                newsSummary.value = summary;
                document.getElementById('manual').checked = true;
                toggleMethod();
                urlLoading.classList.add('d-none');
                return;
            }

            newsTitle.value = title;
            newsImage.value = image;
            newsSummary.value = summary;
            newsLink.value = url;

            urlLoading.classList.add('d-none');
        })
        .catch(err => {
            console.error('Extract error:', err);
            newsLink.value = url;
            urlError.textContent = 'No se pudo extraer info (CORS o sitio no compatible). Usa modo manual.';
            urlError.classList.remove('d-none');
            document.getElementById('manual').checked = true;
            toggleMethod();
            urlLoading.classList.add('d-none');
        });
}

// Handle search and filters
function handleSearch() {
    handleFilter();
}

function handleFilter() {
    const searchTerm = searchInput.value;
    const category = categoryFilter.value;
    const sort = sortSelect.value;
    const selectedTag = tagFilter.value.trim();
    renderAnnotations(currentAnnotations, searchTerm, category, selectedTag, sort);
}

// Update category filter options
function updateCategoryFilter() {
    const categories = [...new Set(currentAnnotations.map(item => item.category).filter(c => c))];
    categoryFilter.innerHTML = '<option value="">Todas las categorías</option>';
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        categoryFilter.appendChild(option);
    });
}

// Toggle dark mode
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    darkModeToggle.textContent = document.body.classList.contains('dark-mode') ? 'Modo Claro' : 'Modo Oscuro';
}

// Export news as JSON
function exportAnnotations() {
    const format = prompt('Formato de exportación (JSON o CSV):', 'JSON').toUpperCase();
    if (format === 'CSV') {
        let csv = 'Título,Resumen,Imagen,Enlace,Categoría,Fecha\n';
        currentAnnotations.forEach(item => {
            csv += `"${item.title.replace(/"/g, '""')}",${item.summary ? `"${item.summary.replace(/"/g, '""')}"` : ''},${item.image || ''},"${item.link.replace(/"/g, '""')}",${item.category || ''},${item.date}\n`;
        });
        const blob = new Blob([csv], {type: 'text/csv'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `anotaciones-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    } else {
        const dataStr = JSON.stringify(currentAnnotations, null, 2);
        const blob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `anotaciones-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
}

// Share news
function shareAnnotation(item) {
    if (navigator.share) {
        navigator.share({
            title: item.title,
            text: item.summary ? item.summary.substring(0, 100) + '...' : '',
            url: item.link
        }).catch(err => console.error('Share failed', err));
    } else {
        navigator.clipboard.writeText(item.link).then(() => {
            alert('Enlace copiado al portapapeles.');
        }).catch(err => {
            console.error('Copy failed', err);
            alert('No se pudo copiar. Copia manual: ' + item.link);
        });
    }
}

// Pagination change
function changePage(page) {
    if (page < 1 || page > Math.ceil(currentAnnotations.length / PAGE_SIZE)) return;
    currentPage = page;
    const searchTerm = searchInput.value;
    const category = categoryFilter.value;
    const selectedTag = tagFilter.value.trim();
    const sort = sortSelect.value;
    renderAnnotations(currentAnnotations, searchTerm, category, selectedTag, sort);
}

// Debounce utility
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}