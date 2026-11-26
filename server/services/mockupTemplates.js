// Static HTML mockup templates (car rental, tourism) used as design starting points.
// Moved out of orchestrator.js unchanged; currently not referenced by the orchestrator.

export function generateCarRentalMockupCode() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DriveX - Premium & Everyday Car Rental</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-950 text-slate-100 font-sans antialiased selection:bg-amber-400 selection:text-slate-950">

  <!-- 1. Navigation Header -->
  <header class="fixed top-0 inset-x-0 z-50 bg-slate-950/85 backdrop-blur-md border-b border-slate-800">
    <div class="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-slate-950 font-black text-xl shadow-lg shadow-amber-500/20">
          🚗
        </div>
        <div>
          <span class="text-lg font-black tracking-tight text-white">DRIVE<span class="text-amber-400">X</span></span>
          <p class="text-[10px] text-amber-400/80 uppercase font-semibold tracking-widest">Car Rental & Fleet Hire</p>
        </div>
      </div>
      
      <nav class="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
        <a href="#fleet" class="hover:text-amber-400 transition">Our Fleet</a>
        <a href="#pricing" class="hover:text-amber-400 transition">Rates & Deals</a>
        <a href="#benefits" class="hover:text-amber-400 transition">Why DriveX</a>
        <a href="#locations" class="hover:text-amber-400 transition">Pickup Points</a>
      </nav>

      <div class="flex items-center gap-4">
        <button onclick="openBookingModal('General')" class="px-5 py-2.5 rounded-full bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs tracking-wide shadow-lg shadow-amber-400/20 transition transform hover:-translate-y-0.5">
          Reserve a Car
        </button>
      </div>
    </div>
  </header>

  <!-- 2. Hero Section with Search & Reservation Widget -->
  <section class="relative pt-36 pb-20 px-6 overflow-hidden">
    <div class="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

    <div class="max-w-5xl mx-auto text-center relative z-10 space-y-6">
      <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-950/60 border border-amber-500/30 text-amber-300 text-xs font-semibold">
        <span>⚡</span> Instant Confirmation • Unlimited Mileage Available • 0% Hidden Fees
      </div>

      <h1 class="text-4xl sm:text-6xl font-extrabold text-white tracking-tight leading-tight sm:leading-none">
        Find, Book & Drive Your <br class="hidden sm:block" />
        <span class="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-300 to-amber-200">Perfect Ride in Minutes</span>
      </h1>

      <p class="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto font-light leading-relaxed">
        From premium luxury sedans and family SUVs to economical daily city cruisers. Clean, insured, and ready when you are.
      </p>

      <!-- Fast Car Booking Bar -->
      <div class="mt-10 p-3 sm:p-5 rounded-3xl bg-slate-900/90 backdrop-blur-xl border border-slate-700/80 shadow-2xl max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-4 gap-3 text-left">
        <div class="px-4 py-2.5 rounded-2xl bg-slate-950/70 border border-slate-800">
          <label class="block text-[10px] uppercase font-bold text-slate-400">Pick-up Location</label>
          <input type="text" placeholder="Colombo Airport / City" class="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none font-semibold mt-0.5" />
        </div>
        <div class="px-4 py-2.5 rounded-2xl bg-slate-950/70 border border-slate-800">
          <label class="block text-[10px] uppercase font-bold text-slate-400">Pick-up Date</label>
          <input type="date" class="w-full bg-transparent text-xs text-white focus:outline-none font-semibold mt-0.5" />
        </div>
        <div class="px-4 py-2.5 rounded-2xl bg-slate-950/70 border border-slate-800">
          <label class="block text-[10px] uppercase font-bold text-slate-400">Vehicle Type</label>
          <select class="w-full bg-transparent text-xs text-white focus:outline-none font-semibold mt-0.5">
            <option class="bg-slate-900">All Categories</option>
            <option class="bg-slate-900">Luxury Sedans</option>
            <option class="bg-slate-900">Family SUVs & 4x4</option>
            <option class="bg-slate-900">Economy Hatchbacks</option>
          </select>
        </div>
        <button onclick="document.getElementById('fleet').scrollIntoView({behavior: 'smooth'})" class="w-full h-full min-h-[48px] rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-400/20 transition">
          <span>Search Fleet</span> &rarr;
        </button>
      </div>
    </div>
  </section>

  <!-- 3. Vehicle Fleet Showcase -->
  <section id="fleet" class="max-w-7xl mx-auto px-6 py-16">
    <div class="flex flex-col sm:flex-row sm:items-end justify-between mb-10 gap-4">
      <div>
        <p class="text-xs font-bold uppercase text-amber-400 tracking-widest">Available Fleet</p>
        <h2 class="text-2xl sm:text-3xl font-bold text-white mt-1">Choose Your Vehicle</h2>
      </div>
      <div class="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
        <button class="px-4 py-1.5 rounded-full bg-amber-400 text-slate-950 text-xs font-bold">All Cars</button>
        <button class="px-4 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400 hover:text-white text-xs font-medium">Sedans</button>
        <button class="px-4 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400 hover:text-white text-xs font-medium">SUVs & 4WD</button>
        <button class="px-4 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400 hover:text-white text-xs font-medium">Electric</button>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <!-- Car Card 1 -->
      <div class="group rounded-3xl overflow-hidden bg-slate-900/90 border border-slate-800 hover:border-amber-400/50 transition-all duration-300 shadow-xl flex flex-col justify-between">
        <div>
          <div class="h-56 bg-cover bg-center relative" style="background-image: url('https://images.unsplash.com/photo-1617814076367-b759c7d7e738?auto=format&fit=crop&w=800&q=80')">
            <div class="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent"></div>
            <span class="absolute top-4 left-4 px-3 py-1 rounded-full bg-amber-400/90 text-slate-950 font-bold text-[10px] uppercase">Luxury Sedan</span>
            <span class="absolute top-4 right-4 px-3 py-1 rounded-full bg-slate-950/80 backdrop-blur border border-slate-700 text-amber-300 font-bold text-xs">⭐ 4.9</span>
          </div>
          <div class="p-6">
            <h3 class="text-xl font-bold text-white group-hover:text-amber-400 transition">BMW 5 Series M Sport</h3>
            <p class="text-xs text-slate-400 mt-1">TwinPower Turbo, adaptive cruise, ambient interior.</p>
            
            <div class="grid grid-cols-3 gap-2 mt-4 text-[11px] text-slate-300">
              <div class="p-2 rounded-xl bg-slate-950/60 border border-slate-800 text-center">⚙️ Auto</div>
              <div class="p-2 rounded-xl bg-slate-950/60 border border-slate-800 text-center">👥 5 Seats</div>
              <div class="p-2 rounded-xl bg-slate-950/60 border border-slate-800 text-center">❄️ Climatronic</div>
            </div>
          </div>
        </div>
        <div class="p-6 pt-0">
          <div class="flex items-center justify-between pt-4 border-t border-slate-800">
            <div>
              <span class="text-[10px] text-slate-400 uppercase">Daily Rate</span>
              <p class="text-lg font-extrabold text-white">$95 <span class="text-xs font-normal text-slate-400">/ day</span></p>
            </div>
            <button onclick="openBookingModal('BMW 5 Series')" class="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs transition shadow-md shadow-amber-400/10">Rent Now</button>
          </div>
        </div>
      </div>

      <!-- Car Card 2 -->
      <div class="group rounded-3xl overflow-hidden bg-slate-900/90 border border-slate-800 hover:border-amber-400/50 transition-all duration-300 shadow-xl flex flex-col justify-between">
        <div>
          <div class="h-56 bg-cover bg-center relative" style="background-image: url('https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=800&q=80')">
            <div class="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent"></div>
            <span class="absolute top-4 left-4 px-3 py-1 rounded-full bg-emerald-400/90 text-slate-950 font-bold text-[10px] uppercase">All-Terrain SUV</span>
            <span class="absolute top-4 right-4 px-3 py-1 rounded-full bg-slate-950/80 backdrop-blur border border-slate-700 text-amber-300 font-bold text-xs">⭐ 5.0</span>
          </div>
          <div class="p-6">
            <h3 class="text-xl font-bold text-white group-hover:text-amber-400 transition">Toyota Land Cruiser Prado</h3>
            <p class="text-xs text-slate-400 mt-1">Full 4WD capability, 7 passenger capacity, roof rack ready.</p>
            
            <div class="grid grid-cols-3 gap-2 mt-4 text-[11px] text-slate-300">
              <div class="p-2 rounded-xl bg-slate-950/60 border border-slate-800 text-center">⛰️ 4x4 Auto</div>
              <div class="p-2 rounded-xl bg-slate-950/60 border border-slate-800 text-center">👥 7 Seats</div>
              <div class="p-2 rounded-xl bg-slate-950/60 border border-slate-800 text-center">🛡️ Heavy Duty</div>
            </div>
          </div>
        </div>
        <div class="p-6 pt-0">
          <div class="flex items-center justify-between pt-4 border-t border-slate-800">
            <div>
              <span class="text-[10px] text-slate-400 uppercase">Daily Rate</span>
              <p class="text-lg font-extrabold text-white">$125 <span class="text-xs font-normal text-slate-400">/ day</span></p>
            </div>
            <button onclick="openBookingModal('Toyota Land Cruiser Prado')" class="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs transition shadow-md shadow-amber-400/10">Rent Now</button>
          </div>
        </div>
      </div>

      <!-- Car Card 3 -->
      <div class="group rounded-3xl overflow-hidden bg-slate-900/90 border border-slate-800 hover:border-amber-400/50 transition-all duration-300 shadow-xl flex flex-col justify-between">
        <div>
          <div class="h-56 bg-cover bg-center relative" style="background-image: url('https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&w=800&q=80')">
            <div class="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent"></div>
            <span class="absolute top-4 left-4 px-3 py-1 rounded-full bg-cyan-400/90 text-slate-950 font-bold text-[10px] uppercase">100% Electric</span>
            <span class="absolute top-4 right-4 px-3 py-1 rounded-full bg-slate-950/80 backdrop-blur border border-slate-700 text-amber-300 font-bold text-xs">⭐ 4.96</span>
          </div>
          <div class="p-6">
            <h3 class="text-xl font-bold text-white group-hover:text-amber-400 transition">Tesla Model 3 Long Range</h3>
            <p class="text-xs text-slate-400 mt-1">500km single charge, Autopilot, glass panoramic roof.</p>
            
            <div class="grid grid-cols-3 gap-2 mt-4 text-[11px] text-slate-300">
              <div class="p-2 rounded-xl bg-slate-950/60 border border-slate-800 text-center">⚡ Electric</div>
              <div class="p-2 rounded-xl bg-slate-950/60 border border-slate-800 text-center">👥 5 Seats</div>
              <div class="p-2 rounded-xl bg-slate-950/60 border border-slate-800 text-center">🔋 Autopilot</div>
            </div>
          </div>
        </div>
        <div class="p-6 pt-0">
          <div class="flex items-center justify-between pt-4 border-t border-slate-800">
            <div>
              <span class="text-[10px] text-slate-400 uppercase">Daily Rate</span>
              <p class="text-lg font-extrabold text-white">$89 <span class="text-xs font-normal text-slate-400">/ day</span></p>
            </div>
            <button onclick="openBookingModal('Tesla Model 3')" class="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs transition shadow-md shadow-amber-400/10">Rent Now</button>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- 4. Interactive Booking Modal -->
  <div id="bookingModal" class="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm hidden items-center justify-center p-4">
    <div class="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative">
      <button onclick="closeBookingModal()" class="absolute top-5 right-5 text-slate-400 hover:text-white text-sm">✕</button>
      <h3 class="text-xl font-bold text-white">Reserve Your Vehicle</h3>
      <p id="modalCarName" class="text-xs text-amber-400 mt-1 font-semibold">BMW 5 Series M Sport</p>

      <form onsubmit="handleReserve(event)" class="mt-6 space-y-4">
        <div>
          <label class="block text-[10px] font-bold uppercase text-slate-400">Your Full Name</label>
          <input required type="text" placeholder="John Doe" class="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400" />
        </div>
        <div>
          <label class="block text-[10px] font-bold uppercase text-slate-400">Phone / WhatsApp</label>
          <input required type="tel" placeholder="+94 77 123 4567" class="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-[10px] font-bold uppercase text-slate-400">Pickup Date</label>
            <input required type="date" class="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400" />
          </div>
          <div>
            <label class="block text-[10px] font-bold uppercase text-slate-400">Return Date</label>
            <input required type="date" class="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400" />
          </div>
        </div>
        <button type="submit" class="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs uppercase tracking-wider transition shadow-lg shadow-amber-400/20">
          Confirm Reservation Request
        </button>
      </form>
    </div>
  </div>

  <script>
    function openBookingModal(car) {
      document.getElementById('modalCarName').innerText = car;
      const modal = document.getElementById('bookingModal');
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
    function closeBookingModal() {
      const modal = document.getElementById('bookingModal');
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
    function handleReserve(e) {
      e.preventDefault();
      alert('✓ Vehicle reservation request submitted successfully! DriveX concierge will contact you within 15 minutes.');
      closeBookingModal();
    }
  </script>
</body>
</html>`;
}

export function generateTourismMockupCode() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CeylonEscape - Tropical Luxury Journeys</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-950 text-slate-100 font-sans antialiased selection:bg-emerald-500 selection:text-slate-950">
  
  <!-- 1. Navigation Header -->
  <header class="fixed top-0 inset-x-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80">
    <div class="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-300 flex items-center justify-center text-slate-950 font-black text-xl shadow-lg shadow-emerald-500/20">
          🌴
        </div>
        <div>
          <span class="text-lg font-black tracking-tight text-white">CEYLON<span class="text-emerald-400">ESCAPE</span></span>
          <p class="text-[10px] text-emerald-400/80 uppercase font-semibold tracking-widest">Tropical Luxury Journeys</p>
        </div>
      </div>
      
      <nav class="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
        <a href="#destinations" class="hover:text-emerald-400 transition">Destinations</a>
        <a href="#packages" class="hover:text-emerald-400 transition">Tour Packages</a>
        <a href="#experiences" class="hover:text-emerald-400 transition">Experiences</a>
        <a href="#reviews" class="hover:text-emerald-400 transition">Travelers</a>
      </nav>

      <div class="flex items-center gap-4">
        <button class="px-5 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs tracking-wide shadow-lg shadow-emerald-500/30 transition transform hover:-translate-y-0.5">
          Book Custom Tour
        </button>
      </div>
    </div>
  </header>

  <!-- 2. Hero Section with Search Widget -->
  <section class="relative pt-36 pb-24 px-6 overflow-hidden">
    <div class="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

    <div class="max-w-5xl mx-auto text-center relative z-10 space-y-6">
      <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
        <span>✨</span> Handcrafted Tropical Expeditions 2026
      </div>

      <h1 class="text-4xl sm:text-6xl font-extrabold text-white tracking-tight leading-tight sm:leading-none">
        Discover Paradise in <br class="hidden sm:block" />
        <span class="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">Unmatched Luxury</span>
      </h1>

      <p class="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto font-light leading-relaxed">
        From ancient misty mountain fortresses to pristine turquoise coastlines, immerse yourself in private, curated island retreats.
      </p>

      <!-- Floating Glassmorphic Search Widget -->
      <div class="mt-10 p-3 sm:p-4 rounded-3xl bg-slate-900/80 backdrop-blur-xl border border-slate-700/80 shadow-2xl max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-4 gap-3 text-left">
        <div class="px-4 py-2 rounded-2xl bg-slate-950/60 border border-slate-800">
          <label class="block text-[10px] uppercase font-bold text-slate-400">Destination</label>
          <input type="text" placeholder="Where to? (e.g. Ella)" class="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none font-semibold mt-0.5" />
        </div>
        <div class="px-4 py-2 rounded-2xl bg-slate-950/60 border border-slate-800">
          <label class="block text-[10px] uppercase font-bold text-slate-400">Departure</label>
          <input type="date" class="w-full bg-transparent text-xs text-white focus:outline-none font-semibold mt-0.5" />
        </div>
        <div class="px-4 py-2 rounded-2xl bg-slate-950/60 border border-slate-800">
          <label class="block text-[10px] uppercase font-bold text-slate-400">Travelers</label>
          <select class="w-full bg-transparent text-xs text-white focus:outline-none font-semibold mt-0.5">
            <option class="bg-slate-900">2 Adults (Private)</option>
            <option class="bg-slate-900">Family (4-6)</option>
            <option class="bg-slate-900">Group Expedition</option>
          </select>
        </div>
        <button class="w-full h-full min-h-[48px] rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition">
          <span>Search Tours</span> &rarr;
        </button>
      </div>
    </div>
  </section>

  <!-- 3. Curated Destinations Grid -->
  <section id="destinations" class="max-w-7xl mx-auto px-6 py-16">
    <div class="flex items-end justify-between mb-10">
      <div>
        <p class="text-xs font-bold uppercase text-emerald-400 tracking-widest">Iconic Escapes</p>
        <h2 class="text-2xl sm:text-3xl font-bold text-white mt-1">Featured Destinations</h2>
      </div>
      <a href="#packages" class="text-xs font-semibold text-emerald-400 hover:text-emerald-300 underline">View all destinations &rarr;</a>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <!-- Card 1 -->
      <div class="group relative rounded-3xl overflow-hidden bg-slate-900 border border-slate-800 hover:border-emerald-500/50 transition-all duration-300 shadow-xl">
        <div class="h-64 bg-cover bg-center relative" style="background-image: url('https://images.unsplash.com/photo-1586861635167-e5223aadc9fe?auto=format&fit=crop&w=800&q=80')">
          <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent"></div>
          <span class="absolute top-4 right-4 px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur border border-slate-700 text-emerald-400 font-bold text-xs">⭐ 4.98</span>
        </div>
        <div class="p-6 relative -mt-8 bg-slate-900/90 backdrop-blur rounded-3xl mx-3 mb-3 border border-slate-800">
          <h3 class="text-lg font-bold text-white group-hover:text-emerald-400 transition">Sigiriya Heritage & Wildlife</h3>
          <p class="text-xs text-slate-400 mt-1 line-clamp-2">Private helicopter tour, 5-star treehouse villas, and VIP sunrise fortress climb.</p>
          <div class="flex items-center justify-between mt-4 pt-4 border-t border-slate-800">
            <div>
              <span class="text-[10px] text-slate-400 uppercase">From</span>
              <p class="text-sm font-extrabold text-white">$1,450 <span class="text-xs font-normal text-slate-400">/ person</span></p>
            </div>
            <button class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 text-xs font-bold text-white transition">Explore</button>
          </div>
        </div>
      </div>

      <!-- Card 2 -->
      <div class="group relative rounded-3xl overflow-hidden bg-slate-900 border border-slate-800 hover:border-emerald-500/50 transition-all duration-300 shadow-xl">
        <div class="h-64 bg-cover bg-center relative" style="background-image: url('https://images.unsplash.com/photo-1546708973-b339540b5162?auto=format&fit=crop&w=800&q=80')">
          <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent"></div>
          <span class="absolute top-4 right-4 px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur border border-slate-700 text-emerald-400 font-bold text-xs">⭐ 4.95</span>
        </div>
        <div class="p-6 relative -mt-8 bg-slate-900/90 backdrop-blur rounded-3xl mx-3 mb-3 border border-slate-800">
          <h3 class="text-lg font-bold text-white group-hover:text-emerald-400 transition">Ella Misty Tea Trails</h3>
          <p class="text-xs text-slate-400 mt-1 line-clamp-2">Luxury colonial train journey, private tea tasting estate, and infinity cloud pool retreat.</p>
          <div class="flex items-center justify-between mt-4 pt-4 border-t border-slate-800">
            <div>
              <span class="text-[10px] text-slate-400 uppercase">From</span>
              <p class="text-sm font-extrabold text-white">$980 <span class="text-xs font-normal text-slate-400">/ person</span></p>
            </div>
            <button class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 text-xs font-bold text-white transition">Explore</button>
          </div>
        </div>
      </div>

      <!-- Card 3 -->
      <div class="group relative rounded-3xl overflow-hidden bg-slate-900 border border-slate-800 hover:border-emerald-500/50 transition-all duration-300 shadow-xl">
        <div class="h-64 bg-cover bg-center relative" style="background-image: url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80')">
          <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent"></div>
          <span class="absolute top-4 right-4 px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur border border-slate-700 text-emerald-400 font-bold text-xs">⭐ 5.0</span>
        </div>
        <div class="p-6 relative -mt-8 bg-slate-900/90 backdrop-blur rounded-3xl mx-3 mb-3 border border-slate-800">
          <h3 class="text-lg font-bold text-white group-hover:text-emerald-400 transition">Mirissa Private Yacht Cruise</h3>
          <p class="text-xs text-slate-400 mt-1 line-clamp-2">Exclusive blue whale watching, private chef dining on deck, and secluded cove snorkeling.</p>
          <div class="flex items-center justify-between mt-4 pt-4 border-t border-slate-800">
            <div>
              <span class="text-[10px] text-slate-400 uppercase">From</span>
              <p class="text-sm font-extrabold text-white">$1,890 <span class="text-xs font-normal text-slate-400">/ person</span></p>
            </div>
            <button class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 text-xs font-bold text-white transition">Explore</button>
          </div>
        </div>
      </div>
    </div>
  </section>

</body>
</html>`;
}
