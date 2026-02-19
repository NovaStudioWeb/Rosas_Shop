/* =========================================
   1. VARIABLES GLOBALES Y ESTADO
   ========================================= */
let database = [];
// Carga el carrito desde localStorage o inicia un array vacío
let carrito = JSON.parse(localStorage.getItem('carrito')) || [];

/**
 * Carga los productos desde el archivo JSON
 */
async function cargarDatos() {
    try {
        // Asegúrate de que la ruta coincida con tu estructura de carpetas
        const respuesta = await fetch('./assets/data/productos.json'); 
        if (!respuesta.ok) throw new Error("No se pudo conectar con la base de datos de productos.");
        
        database = await respuesta.json();
        
        // Una vez cargados los datos, inicializamos la interfaz
        iniciarApp();
    } catch (error) {
        console.error("Error crítico:", error);
        Swal.fire({
            icon: 'error',
            title: 'Error de carga',
            text: 'No pudimos cargar el catálogo. Por favor, intenta más tarde.',
            confirmButtonColor: '#e83e8c'
        });
    }
}

// Iniciar la carga de datos inmediatamente
cargarDatos();

/* =========================================
   2. CONTROLADOR DE PÁGINAS (ROUTER)
   ========================================= */
function iniciarApp() {
    // Estas funciones se ejecutan en todas las páginas para mantener el carrito al día
    actualizarBadge();
    renderizarCarrito();
    initScrollAnimations();

    const path = window.location.pathname;
    
    // Lógica específica según la página actual
    // MODIFICADO: Ahora busca 'index' en lugar de 'index.html' para mayor compatibilidad
    if (path.includes('index') || path === '/' || path.endsWith('/')) {
        renderizarDestacados();
    } 
    // MODIFICADO: Ahora busca 'catalogo' a secas. Esto arregla el error en Netlify.
    else if (path.includes('catalogo')) {
        iniciarSistemaFiltros();

        // --- LÓGICA DE DETECCIÓN POR MEMORIA (localStorage) ---
        const categoriaSolicitada = localStorage.getItem('filtroPendiente');

        if (categoriaSolicitada) {
            // Pequeño retraso de seguridad para asegurar que el HTML del filtro ya exista
            setTimeout(() => {
                const checkbox = document.querySelector(`.filter-check[value="${categoriaSolicitada}"]`);
                if (checkbox) {
                    checkbox.checked = true;
                    // Disparamos el filtrado
                    checkbox.dispatchEvent(new Event('change'));
                }
            }, 50); // 50ms de espera es imperceptible pero ayuda a la estabilidad

            // LIMPIEZA: Borramos el filtro de la memoria
            localStorage.removeItem('filtroPendiente');
        }
    }
    // Agregamos contacto por si acaso, usando la misma lógica flexible
    else if (path.includes('contacto')) {
        // Si tienes una función para contacto, iría aquí.
        if (typeof initFormularioContacto === 'function') {
            initFormularioContacto();
        }
    }
}

/* =========================================
   NUEVO: LÓGICA DE ANIMACIONES (SCROLL)
   ========================================= */
function initScrollAnimations() {
    // Configuración del observador
    const observerOptions = {
        root: null, // Usa el viewport del navegador
        rootMargin: '0px',
        threshold: 0.1 // Se activa cuando el 10% del elemento es visible
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Añade la clase que activa la animación CSS
                entry.target.classList.add('active');
                // Deja de observar el elemento una vez animado para ahorrar recursos
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Seleccionamos todos los elementos que deben animarse
    const elementosAnimables = document.querySelectorAll('.reveal, .animate-on-scroll');
    
    elementosAnimables.forEach(el => {
        observer.observe(el);
    });

    // Fallback de seguridad: si el usuario tiene preferencias de reducción de movimiento
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) {
        elementosAnimables.forEach(el => {
            el.classList.add('active'); // Muestra todo inmediatamente sin animar
            el.style.transition = 'none';
        });
    }
}

/* =========================================
   3. LÓGICA DEL CARRITO DE COMPRAS
   ========================================= */

/**
 * Añade un producto al carrito y dispara una notificación elegante
 */
function agregarAlCarrito(idRecibido) {
    const id = parseInt(idRecibido);
    const productoEncontrado = database.find(item => item.id === id);

    if (!productoEncontrado) return;

    const existeEnCarrito = carrito.find(item => item.id === id);

    if (existeEnCarrito) {
        existeEnCarrito.cantidad++;
    } else {
        carrito.push({ ...productoEncontrado, cantidad: 1 });
    }

    guardarYActualizar();
    
    // Notificación Toast de SweetAlert2
    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2500,
        timerProgressBar: true
    });

    Toast.fire({
        icon: 'success',
        title: `${productoEncontrado.nombre} añadido`
    });
}

function eliminarDelCarrito(id) {
    carrito = carrito.filter(item => item.id !== id);
    guardarYActualizar();
}

function vaciarCarrito() {
    if (carrito.length === 0) return;
    
    Swal.fire({
        title: '¿Vaciar carrito?',
        text: "Se eliminarán todos los productos seleccionados.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#e83e8c',
        cancelButtonColor: '#333',
        confirmButtonText: 'Sí, vaciar',
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (result.isConfirmed) {
            carrito = [];
            guardarYActualizar();
        }
    });
}

function guardarYActualizar() {
    localStorage.setItem('carrito', JSON.stringify(carrito));
    actualizarBadge();
    renderizarCarrito();
}

function actualizarBadge() {
    const badge = document.getElementById('badge-carrito');
    if(badge) {
        const totalItems = carrito.reduce((acc, item) => acc + item.cantidad, 0);
        badge.innerText = totalItems;
        
        // Animación de pulso cuando cambia el número
        badge.style.transform = 'scale(1.3)';
        setTimeout(() => badge.style.transform = 'scale(1)', 200);
    }
}

/**
 * Dibuja los productos dentro del menú lateral (Offcanvas)
 */
function renderizarCarrito() {
    const contenedor = document.getElementById('carrito-items');
    const totalElement = document.getElementById('carrito-total');
    
    if (!contenedor) return;

    contenedor.innerHTML = '';
    let precioTotal = 0;

    if (carrito.length === 0) {
        contenedor.innerHTML = `
            <div class="text-center py-5">
                <i class="fas fa-shopping-basket fa-3x text-muted mb-3" style="opacity:0.3"></i>
                <p class="text-muted">Tu carrito está vacío.</p>
                <button class="btn btn-sm btn-outline-dark rounded-0" data-bs-dismiss="offcanvas">Ir de compras</button>
            </div>`;
        if(totalElement) totalElement.innerText = 'RD$ 0';
        return;
    }

    carrito.forEach(producto => {
        const subtotal = producto.precio * producto.cantidad;
        precioTotal += subtotal;

        contenedor.innerHTML += `
            <div class="d-flex justify-content-between align-items-center mb-3 border-bottom pb-2 animate-fade">
                <div class="d-flex align-items-center">
                    <img src="${producto.imagen}" width="55" height="55" style="object-fit:cover" class="me-3 rounded shadow-sm">
                    <div>
                        <p class="mb-0 small fw-bold text-dark">${producto.nombre}</p>
                        <p class="mb-0 small text-muted">RD$ ${producto.precio.toLocaleString()} x ${producto.cantidad}</p>
                    </div>
                </div>
                <div class="text-end">
                    <p class="mb-0 small fw-bold">RD$ ${subtotal.toLocaleString()}</p>
                    <button onclick="eliminarDelCarrito(${producto.id})" class="btn btn-link text-danger p-0 small">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </div>
        `;
    });

    if(totalElement) totalElement.innerText = `RD$ ${precioTotal.toLocaleString()}`;
}

/**
 * Genera el mensaje de pedido y redirige a WhatsApp
 */
function enviarPedidoWhatsApp() {
    if (carrito.length === 0) {
        Swal.fire('Carrito Vacío', 'Por favor, añade productos antes de completar el pedido.', 'info');
        return;
    }

    const telefono = "18099917494"; 
    let mensaje = "¡Hola Rosa's Shop! 👋 Me gustaría realizar el siguiente pedido:%0A%0A";
    let total = 0;

    carrito.forEach(prod => {
        const subtotal = prod.precio * prod.cantidad;
        total += subtotal;
        // Se añade la información de tallas si existe en el JSON
        const tallasDisponibles = prod.tallas ? ` (Tallas: ${prod.tallas.join(', ')})` : '';
        mensaje += `• *${prod.cantidad}x* ${prod.nombre}${tallasDisponibles} - RD$ ${subtotal.toLocaleString()}%0A`;
    });

    mensaje += `%0A━━━━━━━━━━━━━━━%0A*TOTAL: RD$ ${total.toLocaleString()}*%0A━━━━━━━━━━━━━━━%0A%0A_Por favor, confírmenme disponibilidad para coordinar el pago y envío._`;

    window.open(`https://wa.me/${telefono}?text=${mensaje}`, '_blank');
}

/* =========================================
   4. RENDERIZADO DE COMPONENTES HTML
   ========================================= */

/**
 * Crea el código HTML para una tarjeta de producto estándar
 */
function crearTarjetaProducto(producto) {
    return `
        <div class="col-md-4 col-sm-6 animate-fade mb-4 reveal">
            <div class="card product-card h-100 border-0 shadow-sm overflow-hidden">
                <div class="position-relative overflow-hidden" style="height: 320px;">
                    ${producto.destacado ? '<span class="badge bg-dark position-absolute top-0 start-0 m-3 z-3 rounded-0" style="letter-spacing:1px">DESTACADO</span>' : ''}
                    
                    <span class="badge bg-white text-dark border position-absolute top-0 end-0 m-3 z-3 rounded-0 text-uppercase shadow-sm" style="letter-spacing:1px; font-size: 0.65rem;">
                        ${producto.categoria}
                    </span>

                    <img src="${producto.imagen}" class="card-img-top h-100 w-100" style="object-fit: cover;" alt="${producto.nombre}">
                </div>
                <div class="card-body product-meta d-flex flex-column justify-content-between">
                    <div>
                        <h5 class="card-title h6 fw-bold mb-2">${producto.nombre}</h5>
                        <p class="product-price text-dark mb-1">RD$ ${producto.precio.toLocaleString()}</p>
                        
                        <p class="small text-muted mb-3" style="font-size: 0.85rem;">
                            Talla: <span class="fw-semibold text-dark">${producto.tallas.join(', ')}</span>
                        </p>
                    </div>
                    <button class="btn btn-outline-dark w-100 rounded-0 py-2" onclick="agregarAlCarrito(${producto.id})">
                        Añadir al Carrito
                    </button>
                </div>
            </div>
        </div>
    `;
}

function renderizarDestacados() {
    const contenedor = document.getElementById('contenedor-destacados');
    if (!contenedor) return;
    
    const destacados = database.filter(p => p.destacado).slice(0, 4);
    contenedor.innerHTML = destacados.map(p => crearTarjetaProducto(p)).join('');
}

/* =========================================
   5. SISTEMA DE FILTROS Y BÚSQUEDA
   ========================================= */
function iniciarSistemaFiltros() {
    const contenedor = document.getElementById('contenedor-catalogo');
    const searchInput = document.getElementById('searchInput'); 
    const rangePrecio = document.getElementById('priceRange');
    const labelPrecio = document.getElementById('priceLabel');
    const checks = document.querySelectorAll('.filter-check');
    const contador = document.getElementById('contadorProductos');
    const sortSelect = document.getElementById('sortSelect'); 
    const btnReset = document.getElementById('btnReset'); 

    function filtrarYPintar() {
        const textoBusqueda = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const categoriasActivas = Array.from(checks).filter(chk => chk.checked).map(chk => chk.value);
        const precioMax = rangePrecio ? parseInt(rangePrecio.value) : 10000;

        if(labelPrecio) labelPrecio.innerText = `RD$ ${precioMax.toLocaleString()}`;

        // Lógica de filtrado
        let resultados = database.filter(producto => {
            const pasaBusqueda = producto.nombre.toLowerCase().includes(textoBusqueda);
            const pasaCategoria = categoriasActivas.length === 0 || categoriasActivas.includes(producto.categoria);
            const pasaPrecio = producto.precio <= precioMax;
            return pasaBusqueda && pasaCategoria && pasaPrecio;
        });

        // Lógica de ordenamiento
        if(sortSelect) {
            const orden = sortSelect.value;
            if (orden === 'precio-menor') resultados.sort((a, b) => a.precio - b.precio);
            else if (orden === 'precio-mayor') resultados.sort((a, b) => b.precio - a.precio);
        }

        // Actualizar contador visual
        if(contador) contador.innerText = resultados.length;

        // Renderizar en el contenedor
        if (contenedor) {
            contenedor.innerHTML = '';
            if (resultados.length > 0) {
                contenedor.innerHTML = resultados.map(p => crearTarjetaProducto(p)).join('');
            } else {
                contenedor.innerHTML = `
                    <div class="col-12 text-center py-5 opacity-50">
                        <i class="fas fa-search fa-3x mb-3"></i>
                        <h3>No encontramos coincidencias</h3>
                        <p>Intenta ajustar tus criterios de búsqueda.</p>
                    </div>`;
            }
        }
    }

    // Escuchadores de eventos
    if(searchInput) searchInput.addEventListener('input', filtrarYPintar);
    if(rangePrecio) rangePrecio.addEventListener('input', filtrarYPintar);
    checks.forEach(chk => chk.addEventListener('change', filtrarYPintar));
    if(sortSelect) sortSelect.addEventListener('change', filtrarYPintar);
    
    if(btnReset) btnReset.addEventListener('click', () => {
        if(searchInput) searchInput.value = '';
        checks.forEach(chk => chk.checked = false);
        if(rangePrecio) rangePrecio.value = 10000;
        if(sortSelect) sortSelect.value = 'defecto';
        filtrarYPintar(); 
    });

    // Ejecución inicial
    filtrarYPintar();
}

/* =========================================
   6. SEGURIDAD Y PREVENCIÓN
   ========================================= */

// Deshabilitar menú contextual
document.addEventListener('contextmenu', event => event.preventDefault());

// Bloquear atajos de teclado de herramientas de desarrollador
document.onkeydown = function(e) {
    if(e.keyCode == 123 || 
      (e.ctrlKey && e.shiftKey && (e.keyCode == 73 || e.keyCode == 74)) || 
      (e.ctrlKey && e.keyCode == 85)) {
        return false;
    }
}

/* =========================================
   7. GESTIÓN DE FORMULARIO DE CONTACTO
   ========================================= */
const formularioContacto = document.getElementById('contactForm');

if (formularioContacto) {
    formularioContacto.addEventListener('submit', function(e) {
        e.preventDefault(); 
        
        Swal.fire({
            title: '¡Mensaje Enviado!',
            text: 'Gracias por contactarnos. Rosa o alguien del equipo te responderá pronto.',
            icon: 'success',
            confirmButtonColor: '#e83e8c',
            confirmButtonText: 'Excelente'
        });
        
        formularioContacto.reset(); 
    });
}

// --- LÓGICA DEL CARRUSEL DE CATEGORÍAS ---
document.addEventListener('DOMContentLoaded', function() {
    const scrollContainer = document.getElementById('categoryScrollContainer');
    const leftBtn = document.getElementById('scrollLeftBtn');
    const rightBtn = document.getElementById('scrollRightBtn');

    if (scrollContainer && leftBtn && rightBtn) {
        
        // Cantidad de desplazamiento (ancho de tarjeta + gap)
        const scrollAmount = 240; 

        leftBtn.addEventListener('click', () => {
            scrollContainer.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
        });

        rightBtn.addEventListener('click', () => {
            scrollContainer.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        });
    }
});