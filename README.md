Work on it: https://code.likeagirl.io/a-complete-guide-to-build-test-and-deploy-a-spring-boot-application-8326f2434f26


code :
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {FunctionDeclaration, GoogleGenAI, Type} from '@google/genai';

const {Map} = await google.maps.importLibrary('maps');
const {LatLngBounds} = await google.maps.importLibrary('core');
const {AdvancedMarkerElement} = await google.maps.importLibrary('marker');

// Application state variables
let map; // Holds the Google Map instance
let points = []; // Array to store geographical points from responses
let markers = []; // Array to store map markers
let lines = []; // Array to store polylines representing routes/connections
let popUps = []; // Array to store custom popups for locations
let bounds; // Google Maps LatLngBounds object to fit map around points
let activeCardIndex = 0; // Index of the currently selected location card
let isPlannerMode = false; // Flag to indicate if Day Planner mode is active
let dayPlanItinerary = []; // Array to hold structured items for the day plan timeline

// DOM Element references
const generateButton = document.querySelector('#generate');
const resetButton = document.querySelector('#reset');
const cardContainer = document.querySelector(
  '#card-container',
) as HTMLDivElement;
const carouselIndicators = document.querySelector(
  '#carousel-indicators',
) as HTMLDivElement;
const prevCardButton = document.querySelector(
  '#prev-card',
) as HTMLButtonElement;
const nextCardButton = document.querySelector(
  '#next-card',
) as HTMLButtonElement;
const cardCarousel = document.querySelector('.card-carousel') as HTMLDivElement;
const plannerModeToggle = document.querySelector(
  '#planner-mode-toggle',
) as HTMLInputElement;
const timelineContainer = document.querySelector(
  '#timeline-container',
) as HTMLDivElement;
const timeline = document.querySelector('#timeline') as HTMLDivElement;
const closeTimelineButton = document.querySelector(
  '#close-timeline',
) as HTMLButtonElement;
const exportPlanButton = document.querySelector(
  '#export-plan',
) as HTMLButtonElement;
const mapContainer = document.querySelector('#map-container');
const timelineToggle = document.querySelector('#timeline-toggle');
const mapOverlay = document.querySelector('#map-overlay');
const spinner = document.querySelector('#spinner');
const errorMessage = document.querySelector('#error-message');

// Initializes the Google Map instance and necessary libraries.
async function initMap() {
  bounds = new LatLngBounds();

  map = new Map(document.getElementById('map'), {
    center: {lat: -34.397, lng: 150.644}, // Default center
    zoom: 8, // Default zoom
    mapId: '4504f8b37365c3d0', // Custom map ID for styling
    gestureHandling: 'greedy', // Allows easy map interaction on all devices
    zoomControl: false,
    cameraControl: false,
    mapTypeControl: false,
    scaleControl: false,
    streetViewControl: false,
    rotateControl: false,
    fullscreenControl: false,
  });

  // Define a custom Popup class extending Google Maps OverlayView.
  // This allows for custom HTML content near map markers.
  window.Popup = class Popup extends google.maps.OverlayView {
    position;
    containerDiv;
    constructor(position, content) {
      super();
      this.position = position;
      content.classList.add('popup-bubble');

      this.containerDiv = document.createElement('div');
      this.containerDiv.classList.add('popup-container');
      this.containerDiv.appendChild(content); // Append the actual content here
      // Prevent clicks inside the popup from propagating to the map.
      Popup.preventMapHitsAndGesturesFrom(this.containerDiv);
    }

    /** Called when the popup is added to the map via setMap(). */
    onAdd() {
      this.getPanes().floatPane.appendChild(this.containerDiv);
    }

    /** Called when the popup is removed from the map via setMap(null). */
    onRemove() {
      if (this.containerDiv.parentElement) {
        this.containerDiv.parentElement.removeChild(this.containerDiv);
      }
    }

    /** Called each frame when the popup needs to draw itself. */
    draw() {
      const divPosition = this.getProjection().fromLatLngToDivPixel(
        this.position,
      );
      // Hide the popup when it is far out of view for performance.
      const display =
        Math.abs(divPosition.x) < 4000 && Math.abs(divPosition.y) < 4000
          ? 'block'
          : 'none';

      if (display === 'block') {
        this.containerDiv.style.left = divPosition.x + 'px';
        this.containerDiv.style.top = divPosition.y + 'px';
      }

      if (this.containerDiv.style.display !== display) {
        this.containerDiv.style.display = display;
      }
    }
  };
}

// Initialize the map as soon as the script loads.
initMap();

// Function declaration for extracting location data using Google AI.
const locationFunctionDeclaration: FunctionDeclaration = {
  name: 'location',
  parameters: {
    type: Type.OBJECT,
    description: 'Geographic coordinates of a location.',
    properties: {
      name: {
        type: Type.STRING,
        description: 'Name of the location.',
      },
      description: {
        type: Type.STRING,
        description:
          'Description of the location: why is it relevant, details to know.',
      },
      lat: {
        type: Type.STRING,
        description: 'Latitude of the location.',
      },
      lng: {
        type: Type.STRING,
        description: 'Longitude of the location.',
      },
      // Properties specific to Day Planner mode
      time: {
        type: Type.STRING,
        description:
          'Time of day to visit this location (e.g., "09:00", "14:30").',
      },
      duration: {
        type: Type.STRING,
        description:
          'Suggested duration of stay at this location (e.g., "1 hour", "45 minutes").',
      },
      sequence: {
        type: Type.NUMBER,
        description: 'Order in the day itinerary (1 = first stop of the day).',
      },
    },
    required: ['name', 'description', 'lat', 'lng'],
  },
};

// Function declaration for extracting route/line data using Google AI.
const lineFunctionDeclaration: FunctionDeclaration = {
  name: 'line',
  parameters: {
    type: Type.OBJECT,
    description: 'Connection between a start location and an end location.',
    properties: {
      name: {
        type: Type.STRING,
        description: 'Name of the route or connection',
      },
      start: {
        type: Type.OBJECT,
        description: 'Start location of the route',
        properties: {
          lat: {
            type: Type.STRING,
            description: 'Latitude of the start location.',
          },
          lng: {
            type: Type.STRING,
            description: 'Longitude of the start location.',
          },
        },
      },
      end: {
        type: Type.OBJECT,
        description: 'End location of the route',
        properties: {
          lat: {
            type: Type.STRING,
            description: 'Latitude of the end location.',
          },
          lng: {
            type: Type.STRING,
            description: 'Longitude of the end location.',
          },
        },
      },
      // Properties specific to Day Planner mode
      transport: {
        type: Type.STRING,
        description:
          'Mode of transportation between locations (e.g., "walking", "driving", "public transit").',
      },
      travelTime: {
        type: Type.STRING,
        description:
          'Estimated travel time between locations (e.g., "15 minutes", "1 hour").',
      },
    },
    required: ['name', 'start', 'end'],
  },
};

// System instructions provided to the Google AI model guiding its responses.
const systemInstructions = `## System Instructions for an Interactive Map Explorer

**Model Persona:** You are a knowledgeable, geographically-aware assistant that provides visual information through maps.
Your primary goal is to answer any location-related query comprehensively, using map-based visualizations.
You can process information about virtually any place, real or fictional, past, present, or future.

**Core Capabilities:**

1. **Geographic Knowledge:** You possess extensive knowledge of:
   * Global locations, landmarks, and attractions
   * Historical sites and their significance
   * Natural wonders and geography
   * Cultural points of interest
   * Travel routes and transportation options

2. **Two Operation Modes:**

   **A. General Explorer Mode** (Default when DAY_PLANNER_MODE is false):
   * Respond to any query by identifying relevant geographic locations
   * Show multiple points of interest related to the query
   * Provide rich descriptions for each location
   * Connect related locations with appropriate paths
   * Focus on information delivery rather than scheduling

   **B. Day Planner Mode** (When DAY_PLANNER_MODE is true):
   * Create detailed day itineraries with:
     * A logical sequence of locations to visit throughout a day (typically 4-6 major stops)
     * Specific times and realistic durations for each location visit
     * Travel routes between locations with appropriate transportation methods
     * A balanced schedule considering travel time, meal breaks, and visit durations
     * Each location must include a 'time' (e.g., "09:00") and 'duration' property
     * Each location must include a 'sequence' number (1, 2, 3, etc.) to indicate order
     * Each line connecting locations should include 'transport' and 'travelTime' properties

**Output Format:**

1. **General Explorer Mode:**
   * Use the "location" function for each relevant point of interest with name, description, lat, lng
   * Use the "line" function to connect related locations if appropriate
   * Provide as many interesting locations as possible (4-8 is ideal)
   * Ensure each location has a meaningful description

2. **Day Planner Mode:**
   * Use the "location" function for each stop with required time, duration, and sequence properties
   * Use the "line" function to connect stops with transport and travelTime properties
   * Structure the day in a logical sequence with realistic timing
   * Include specific details about what to do at each location

**Important Guidelines:**
* For ANY query, always provide geographic data through the location function
* If unsure about a specific location, use your best judgment to provide coordinates
* Never reply with just questions or requests for clarification
* Always attempt to map the information visually, even for complex or abstract queries
* For day plans, create realistic schedules that start no earlier than 8:00am and end by 9:00pm

Remember: In default mode, respond to ANY query by finding relevant locations to display on the map, even if not explicitly about travel or geography. In day planner mode, create structured day itineraries.`;

// Initialize the Google AI client.
const ai = new GoogleGenAI({vertexai: false, apiKey: process.env.GEMINI_API_KEY});

// Functions to control the visibility of the timeline panel.
function showTimeline() {
  if (timelineContainer) {
    timelineContainer.style.display = 'block';

    // Delay adding 'visible' class for CSS transition effect.
    setTimeout(() => {
      timelineContainer.classList.add('visible');

      if (window.innerWidth > 768) {
        // Desktop view
        mapContainer.classList.add('map-container-shifted');
        adjustInterfaceForTimeline(true);
        window.dispatchEvent(new Event('resize')); // Force map redraw
      } else {
        // Mobile view
        mapOverlay.classList.add('visible');
      }
    }, 10);
  }
}

function hideTimeline() {
  if (timelineContainer) {
    timelineContainer.classList.remove('visible');
    mapContainer.classList.remove('map-container-shifted');
    mapOverlay.classList.remove('visible');
    adjustInterfaceForTimeline(false);

    // Wait for transition before setting display to none.
    setTimeout(() => {
      timelineContainer.style.display = 'none';
      window.dispatchEvent(new Event('resize'));
    }, 300);
  }
}

// Adjusts map bounds when the timeline visibility changes.
function adjustInterfaceForTimeline(isTimelineVisible) {
  if (bounds && map) {
    setTimeout(() => {
      map.fitBounds(bounds);
    }, 350); // Delay to allow layout adjustments
  }
}

// Event Listeners for UI elements.
const promptInput = document.querySelector(
  '#prompt-input',
) as HTMLTextAreaElement;
promptInput.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.code === 'Enter' && !e.shiftKey) {
    // Allow shift+enter for new lines
    const buttonEl = document.getElementById('generate') as HTMLButtonElement;
    buttonEl.classList.add('loading');
    e.preventDefault();
    e.stopPropagation();

    setTimeout(() => {
      sendText(promptInput.value);
      promptInput.value = '';
    }, 10); // Delay to show loading state
  }
});

generateButton.addEventListener('click', (e) => {
  const buttonEl = e.currentTarget as HTMLButtonElement;
  buttonEl.classList.add('loading');

  setTimeout(() => {
    sendText(promptInput.value);
  }, 10);
});

resetButton.addEventListener('click', (e) => {
  restart();
});

if (prevCardButton) {
  prevCardButton.addEventListener('click', () => {
    navigateCards(-1);
  });
}

if (nextCardButton) {
  nextCardButton.addEventListener('click', () => {
    navigateCards(1);
  });
}

if (plannerModeToggle) {
  plannerModeToggle.addEventListener('change', () => {
    isPlannerMode = plannerModeToggle.checked;
    promptInput.placeholder = isPlannerMode
      ? "Create a day plan in... (e.g. 'Plan a day exploring Central Park' or 'One day in Paris')"
      : 'Explore places, history, events, or ask about any location...';

    if (!isPlannerMode && timelineContainer) {
      hideTimeline();
    }
  });
}

if (closeTimelineButton) {
  closeTimelineButton.addEventListener('click', () => {
    hideTimeline();
  });
}

if (timelineToggle) {
  timelineToggle.addEventListener('click', () => {
    showTimeline();
  });
}

if (mapOverlay) {
  mapOverlay.addEventListener('click', () => {
    hideTimeline();
  });
}

if (exportPlanButton) {
  exportPlanButton.addEventListener('click', () => {
    exportDayPlan();
  });
}

// Resets the map and application state to initial conditions.
function restart() {
  points = [];
  bounds = new google.maps.LatLngBounds();
  dayPlanItinerary = [];

  markers.forEach((marker) => marker.setMap(null));
  markers = [];

  lines.forEach((line) => {
    line.poly.setMap(null);
    line.geodesicPoly.setMap(null);
  });
  lines = [];

  popUps.forEach((popup) => {
    popup.popup.setMap(null);
    if (popup.content && popup.content.remove) popup.content.remove();
  });
  popUps = [];

  if (cardContainer) cardContainer.innerHTML = '';
  if (carouselIndicators) carouselIndicators.innerHTML = '';
  if (cardCarousel) cardCarousel.style.display = 'none';
  if (timeline) timeline.innerHTML = '';
  if (timelineContainer) hideTimeline();
}

// Sends the user's prompt to the Google AI and processes the response.
async function sendText(prompt: string) {
  spinner.classList.remove('hidden');
  errorMessage.innerHTML = '';
  restart();
  const buttonEl = document.getElementById('generate') as HTMLButtonElement;

  try {
    let finalPrompt = prompt;
    if (isPlannerMode) {
      finalPrompt = prompt + ' day trip';
    }

    const updatedInstructions = isPlannerMode
      ? systemInstructions.replace('DAY_PLANNER_MODE', 'true')
      : systemInstructions.replace('DAY_PLANNER_MODE', 'false');

    const response = await ai.models.generateContentStream({
      model: 'gemini-2.0-flash-exp',
      contents: finalPrompt,
      config: {
        systemInstruction: updatedInstructions,
        temperature: 1,
        tools: [
          {
            functionDeclarations: [
              locationFunctionDeclaration,
              lineFunctionDeclaration,
            ],
          },
        ],
      },
    });

    let text = '';
    let results = false;
    for await (const chunk of response) {
      const fns = chunk.functionCalls ?? [];
      for (const fn of fns) {
        if (fn.name === 'location') {
          await setPin(fn.args);
          results = true;
        }
        if (fn.name === 'line') {
          await setLeg(fn.args);
          results = true;
        }
      }

      if (
        chunk.candidates &&
        chunk.candidates.length > 0 &&
        chunk.candidates[0].content &&
        chunk.candidates[0].content.parts
      ) {
        chunk.candidates[0].content.parts.forEach((part) => {
          if (part.text) text += part.text;
        });
      } else if (chunk.text) {
        text += chunk.text;
      }
    }

    if (!results) {
      throw new Error(
        'Could not generate any results. Try again, or try a different prompt.',
      );
    }

    if (isPlannerMode && dayPlanItinerary.length > 0) {
      dayPlanItinerary.sort(
        (a, b) =>
          (a.sequence || Infinity) - (b.sequence || Infinity) ||
          (a.time || '').localeCompare(b.time || ''),
      );
      createTimeline();
      showTimeline();
    }

    createLocationCards();
  } catch (e) {
    errorMessage.innerHTML = e.message;
    console.error('Error generating content:', e);
  } finally {
    buttonEl.classList.remove('loading');
  }
  spinner.classList.add('hidden');
}

// Adds a pin (marker and popup) to the map for a given location.
async function setPin(args) {
  const point = {lat: Number(args.lat), lng: Number(args.lng)};
  points.push(point);
  bounds.extend(point);

  const marker = new AdvancedMarkerElement({
    map,
    position: point,
    title: args.name,
  });
  markers.push(marker);
  map.panTo(point);
  map.fitBounds(bounds);

  const content = document.createElement('div');
  let timeInfo = '';
  if (args.time) {
    timeInfo = `<div style="margin-top: 4px; font-size: 12px; color: #2196F3;">
                  <i class="fas fa-clock"></i> ${args.time}
                  ${args.duration ? ` • ${args.duration}` : ''}
                </div>`;
  }
  content.innerHTML = `<b>${args.name}</b><br/>${args.description}${timeInfo}`;

  const popup = new window.Popup(new google.maps.LatLng(point), content);

  if (!isPlannerMode) {
    popup.setMap(map);
  }

  const locationInfo = {
    name: args.name,
    description: args.description,
    position: new google.maps.LatLng(point),
    popup,
    content,
    time: args.time,
    duration: args.duration,
    sequence: args.sequence,
  };

  popUps.push(locationInfo);

  if (isPlannerMode && args.time) {
    dayPlanItinerary.push(locationInfo);
  }
}

// Adds a line (route) between two locations on the map.
async function setLeg(args) {
  const start = {
    lat: Number(args.start.lat),
    lng: Number(args.start.lng),
  };
  const end = {lat: Number(args.end.lat), lng: Number(args.end.lng)};
  points.push(start);
  points.push(end);
  bounds.extend(start);
  bounds.extend(end);
  map.fitBounds(bounds);

  const polyOptions = {
    strokeOpacity: 0.0, // Invisible base line
    strokeWeight: 3,
    map,
  };

  const geodesicPolyOptions = {
    strokeColor: isPlannerMode ? '#2196F3' : '#CC0099',
    strokeOpacity: 1.0,
    strokeWeight: isPlannerMode ? 4 : 3,
    map,
  };

  if (isPlannerMode) {
    geodesicPolyOptions['icons'] = [
      {
        icon: {path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3},
        offset: '0',
        repeat: '15px',
      },
    ];
  }

  const poly = new google.maps.Polyline(polyOptions);
  const geodesicPoly = new google.maps.Polyline(geodesicPolyOptions);

  const path = [start, end];
  poly.setPath(path);
  geodesicPoly.setPath(path);

  lines.push({
    poly,
    geodesicPoly,
    name: args.name,
    transport: args.transport,
    travelTime: args.travelTime,
  });
}

// Creates and populates the timeline view for the day plan.
function createTimeline() {
  if (!timeline || dayPlanItinerary.length === 0) return;
  timeline.innerHTML = '';

  dayPlanItinerary.forEach((item, index) => {
    const timelineItem = document.createElement('div');
    timelineItem.className = 'timeline-item';
    const timeDisplay = item.time || 'Flexible';

    timelineItem.innerHTML = `
      <div class="timeline-time">${timeDisplay}</div>
      <div class="timeline-connector">
        <div class="timeline-dot"></div>
        <div class="timeline-line"></div>
      </div>
      <div class="timeline-content" data-index="${index}">
        <div class="timeline-title">${item.name}</div>
        <div class="timeline-description">${item.description}</div>
        ${item.duration ? `<div class="timeline-duration">${item.duration}</div>` : ''}
      </div>
    `;

    const timelineContent = timelineItem.querySelector('.timeline-content');
    if (timelineContent) {
      timelineContent.addEventListener('click', () => {
        const popupIndex = popUps.findIndex((p) => p.name === item.name);
        if (popupIndex !== -1) {
          highlightCard(popupIndex);
          map.panTo(popUps[popupIndex].position);
        }
      });
    }
    timeline.appendChild(timelineItem);
  });

  if (lines.length > 0 && isPlannerMode) {
    const timelineItems = timeline.querySelectorAll('.timeline-item');
    for (let i = 0; i < timelineItems.length - 1; i++) {
      const currentItem = dayPlanItinerary[i];
      const nextItem = dayPlanItinerary[i + 1];
      const connectingLine = lines.find(
        (line) =>
          line.name.includes(currentItem.name) ||
          line.name.includes(nextItem.name),
      );

      if (
        connectingLine &&
        (connectingLine.transport || connectingLine.travelTime)
      ) {
        const transportItem = document.createElement('div');
        transportItem.className = 'timeline-item transport-item';
        transportItem.innerHTML = `
          <div class="timeline-time"></div>
          <div class="timeline-connector">
            <div class="timeline-dot" style="background-color: #999;"></div>
            <div class="timeline-line"></div>
          </div>
          <div class="timeline-content transport">
            <div class="timeline-title">
              <i class="fas fa-${getTransportIcon(connectingLine.transport || 'travel')}"></i>
              ${connectingLine.transport || 'Travel'}
            </div>
            <div class="timeline-description">${connectingLine.name}</div>
            ${connectingLine.travelTime ? `<div class="timeline-duration">${connectingLine.travelTime}</div>` : ''}
          </div>
        `;
        timelineItems[i].after(transportItem);
      }
    }
  }
}

// Returns an appropriate Font Awesome icon class based on transport type.
function getTransportIcon(transportType: string): string {
  const type = (transportType || '').toLowerCase();
  if (type.includes('walk')) {
    return 'walking';
  }
  if (type.includes('car') || type.includes('driv')) {
    return 'car-side';
  }
  if (
    type.includes('bus') ||
    type.includes('transit') ||
    type.includes('public')
  ) {
    return 'bus-alt';
  }
  if (
    type.includes('train') ||
    type.includes('subway') ||
    type.includes('metro')
  ) {
    return 'train';
  }
  if (type.includes('bike') || type.includes('cycl')) {
    return 'bicycle';
  }
  if (type.includes('taxi') || type.includes('cab')) {
    return 'taxi';
  }
  if (type.includes('boat') || type.includes('ferry')) {
    return 'ship';
  }
  if (type.includes('plane') || type.includes('fly')) {
    return 'plane-departure';
  }
  {
    return 'route';
  } // Default icon
}

// Generates a placeholder SVG image for location cards.
function getPlaceholderImage(locationName: string): string {
  let hash = 0;
  for (let i = 0; i < locationName.length; i++) {
    hash = locationName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = hash % 360;
  const saturation = 60 + (hash % 30);
  const lightness = 50 + (hash % 20);
  const letter = locationName.charAt(0).toUpperCase() || '?';

  return `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="300" height="180" viewBox="0 0 300 180">
      <rect width="300" height="180" fill="hsl(${hue}, ${saturation}%, ${lightness}%)" />
      <text x="150" y="95" font-family="Arial, sans-serif" font-size="72" fill="white" text-anchor="middle" dominant-baseline="middle">${letter}</text>
    </svg>
  `)}`;
}

// Creates and displays location cards in the carousel.
function createLocationCards() {
  if (!cardContainer || !carouselIndicators || popUps.length === 0) return;
  cardContainer.innerHTML = '';
  carouselIndicators.innerHTML = '';
  cardCarousel.style.display = 'block';

  popUps.forEach((location, index) => {
    const card = document.createElement('div');
    card.className = 'location-card';
    if (isPlannerMode) card.classList.add('day-planner-card');
    if (index === 0) card.classList.add('card-active');

    const imageUrl = getPlaceholderImage(location.name);
    let cardContent = `<div class="card-image" style="background-image: url('${imageUrl}')"></div>`;

    if (isPlannerMode) {
      if (location.sequence) {
        cardContent += `<div class="card-sequence-badge">${location.sequence}</div>`;
      }
      if (location.time) {
        cardContent += `<div class="card-time-badge">${location.time}</div>`;
      }
    }

    cardContent += `
      <div class="card-content">
        <h3 class="card-title">${location.name}</h3>
        <p class="card-description">${location.description}</p>
        ${isPlannerMode && location.duration ? `<div class="card-duration">${location.duration}</div>` : ''}
        <div class="card-coordinates">
          ${location.position.lat().toFixed(5)}, ${location.position.lng().toFixed(5)}
        </div>
      </div>
    `;
    card.innerHTML = cardContent;

    card.addEventListener('click', () => {
      highlightCard(index);
      map.panTo(location.position);
      if (isPlannerMode && timeline) highlightTimelineItem(index);
    });

    cardContainer.appendChild(card);

    const dot = document.createElement('div');
    dot.className = 'carousel-dot';
    if (index === 0) dot.classList.add('active');
    carouselIndicators.appendChild(dot);
  });

  if (cardCarousel && popUps.length > 0) {
    cardCarousel.style.display = 'block';
  }
}

// Highlights the selected card and corresponding elements.
function highlightCard(index: number) {
  activeCardIndex = index;
  const cards = cardContainer?.querySelectorAll('.location-card');
  if (!cards) return;

  cards.forEach((card) => card.classList.remove('card-active'));
  if (cards[index]) {
    cards[index].classList.add('card-active');
    const cardWidth = cards[index].offsetWidth;
    const containerWidth = cardContainer.offsetWidth;
    const scrollPosition =
      cards[index].offsetLeft - containerWidth / 2 + cardWidth / 2;
    cardContainer.scrollTo({left: scrollPosition, behavior: 'smooth'});
  }

  const dots = carouselIndicators?.querySelectorAll('.carousel-dot');
  if (dots) {
    dots.forEach((dot, i) => dot.classList.toggle('active', i === index));
  }

  popUps.forEach((popup, i) => {
    popup.popup.setMap(isPlannerMode ? (i === index ? map : null) : map);
    if (popup.content) {
      popup.content.classList.toggle('popup-active', i === index);
    }
  });

  if (isPlannerMode) highlightTimelineItem(index);
}

// Highlights the timeline item corresponding to the selected card.
function highlightTimelineItem(cardIndex: number) {
  if (!timeline) return;
  const timelineItems = timeline.querySelectorAll(
    '.timeline-content:not(.transport)',
  );
  timelineItems.forEach((item) => item.classList.remove('active'));

  const location = popUps[cardIndex];
  for (const item of timelineItems) {
    const title = item.querySelector('.timeline-title');
    if (title && title.textContent === location.name) {
      item.classList.add('active');
      item.scrollIntoView({behavior: 'smooth', block: 'nearest'});
      break;
    }
  }
}

// Allows navigation through cards using arrow buttons.
function navigateCards(direction: number) {
  const newIndex = activeCardIndex + direction;
  if (newIndex >= 0 && newIndex < popUps.length) {
    highlightCard(newIndex);
    map.panTo(popUps[newIndex].position);
  }
}

// Exports the current day plan as a simple text file.
function exportDayPlan() {
  if (!dayPlanItinerary.length) return;
  let content = '# Your Day Plan\n\n';

  dayPlanItinerary.forEach((item, index) => {
    content += `## ${index + 1}. ${item.name}\n`;
    content += `Time: ${item.time || 'Flexible'}\n`;
    if (item.duration) content += `Duration: ${item.duration}\n`;
    content += `\n${item.description}\n\n`;

    if (index < dayPlanItinerary.length - 1) {
      const nextItem = dayPlanItinerary[index + 1];
      const connectingLine = lines.find(
        (line) =>
          line.name.includes(item.name) || line.name.includes(nextItem.name),
      );
      if (connectingLine) {
        content += `### Travel to ${nextItem.name}\n`;
        content += `Method: ${connectingLine.transport || 'Not specified'}\n`;
        if (connectingLine.travelTime) {
          content += `Time: ${connectingLine.travelTime}\n`;
        }
        content += `\n`;
      }
    }
  });

  const blob = new Blob([content], {type: 'text/plain;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'day-plan.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}




travelling-guide:
# Complete Learning Roadmap: Interactive Map Application

## 🎯 Learning Path Overview

This roadmap will take you from zero to building a production-ready interactive map application. Estimated time: **3-4 months** (assuming 2-3 hours daily).

---

## Phase 1: Foundation (3-4 weeks)

### Week 1-2: Web Development Fundamentals

**HTML/CSS/JavaScript Basics**
- **Resource**: [freeCodeCamp Web Development](https://www.freecodecamp.org/learn/2022/responsive-web-design/)
- **Focus**: HTML structure, CSS styling, basic JavaScript
- **Practice Project**: Build a simple webpage with interactive elements

**Modern JavaScript (ES6+)**
- **Resource**: [JavaScript.info](https://javascript.info/)
- **Key Topics**: 
  - Promises & Async/Await
  - Arrow functions
  - Destructuring
  - Modules (import/export)
  - Classes
- **Practice**: Build a weather app using fetch API

**DOM Manipulation**
- **Resource**: [MDN DOM Introduction](https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model/Introduction)
- **Practice**: Create dynamic content with vanilla JavaScript

### Week 3-4: TypeScript Fundamentals

**TypeScript Basics**
- **Resource**: [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- **Free Course**: [TypeScript Course by Net Ninja](https://www.youtube.com/playlist?list=PL4cUxeGkcC9gUgr39Q_yD6v-bSyMwDPUI)
- **Key Topics**:
  - Types and interfaces
  - Classes and inheritance
  - Generics
  - Type assertions
  - Module systems

**Practice Project**: Convert a JavaScript project to TypeScript

---

## Phase 2: Core Technologies (4-5 weeks)

### Week 5-6: Google Maps API

**Getting Started**
- **Official Docs**: [Google Maps JavaScript API](https://developers.google.com/maps/documentation/javascript)
- **Tutorial**: [Google Maps Platform YouTube Channel](https://www.youtube.com/c/GoogleMapsPlatform)

**Key Concepts to Master**:
```javascript
// 1. Basic map initialization
const map = new google.maps.Map(document.getElementById("map"), {
  zoom: 4,
  center: { lat: -25.344, lng: 131.031 },
});

// 2. Adding markers
const marker = new google.maps.Marker({
  position: { lat: -25.344, lng: 131.031 },
  map: map,
});

// 3. Custom overlays and popups
// 4. Polylines for routes
// 5. Event handling
```

**Practice Projects**:
1. **Simple Map**: Display a map with your location
2. **Multiple Markers**: Add 5 different locations
3. **Custom Popups**: Show detailed information on marker click
4. **Route Drawing**: Connect markers with lines

**Resources**:
- [Google Maps Samples](https://github.com/googlemaps/js-samples)
- [Codelabs Tutorial](https://codelabs.developers.google.com/maps-platform/)

### Week 7-8: API Integration & Async Programming

**Fetch API & Promises**
- **Resource**: [MDN Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
- **Practice**: Build a simple API client

**Google AI/Gemini API**
- **Resource**: [Google AI JavaScript SDK](https://ai.google.dev/tutorials/web_quickstart)
- **Key Topics**:
  - API authentication
  - Function calling
  - Streaming responses
  - Error handling

**Practice Project**: Build a simple chatbot that calls external APIs

### Week 9: Advanced JavaScript Patterns

**Object-Oriented Programming**
- **Resource**: [MDN Classes](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes)
- **Patterns**: Factory, Observer, Module patterns
- **Practice**: Refactor previous projects using classes

**Event-Driven Architecture**
- **Resource**: [JavaScript Event System](https://javascript.info/introduction-browser-events)
- **Practice**: Build a simple event system

---

## Phase 3: Building the Application (3-4 weeks)

### Week 10: Project Setup & Architecture

**Development Environment**
```bash
# 1. Set up Node.js and npm
# 2. Initialize TypeScript project
npm init -y
npm install -D typescript @types/node
npx tsc --init

# 3. Set up build tools
npm install -D vite
```

**Project Structure**
```
project/
├── src/
│   ├── types/           # TypeScript interfaces
│   ├── components/      # UI components
│   ├── services/        # API services
│   ├── utils/           # Helper functions
│   └── main.ts          # Entry point
├── public/
├── index.html
└── package.json
```

**Resources**:
- [Vite Documentation](https://vitejs.dev/guide/)
- [TypeScript Project Setup](https://www.typescriptlang.org/docs/handbook/intro.html)

### Week 11-12: Core Features Implementation

**Step-by-Step Build Process**:

1. **Basic Map Setup**
```typescript
// Start with this simple structure
class MapApplication {
  private map: google.maps.Map;
  
  constructor() {
    this.initializeMap();
  }
  
  private initializeMap() {
    // Your map initialization code
  }
}
```

2. **Add Location Management**
```typescript
interface Location {
  name: string;
  lat: number;
  lng: number;
  description: string;
}

class LocationManager {
  private locations: Location[] = [];
  
  addLocation(location: Location) {
    // Add to map and UI
  }
}
```

3. **Integrate AI Services**
4. **Build UI Components**
5. **Add Interaction Logic**

**Daily Tasks**:
- Day 1-2: Map initialization and basic markers
- Day 3-4: Custom popups and UI
- Day 5-6: AI integration for location extraction
- Day 7-8: Timeline and day planner features
- Day 9-10: Polish and bug fixes

### Week 13: Advanced Features

**Timeline Implementation**
- Dynamic timeline generation
- Interactive elements
- Responsive design

**Export Functionality**
- File generation
- Data formatting
- Download handling

---

## Phase 4: Production & Deployment (2-3 weeks)

### Week 14-15: Testing & Quality

**Testing Setup**
- **Resource**: [Jest Documentation](https://jestjs.io/docs/getting-started)
- **Types**: Unit tests, integration tests
- **Practice**: Write tests for your components

**Code Quality**
- **ESLint**: [ESLint TypeScript Guide](https://typescript-eslint.io/getting-started/)
- **Prettier**: Code formatting
- **Husky**: Git hooks for quality checks

### Week 16: Deployment

**Build Process**
```bash
# Production build
npm run build

# Deploy to platforms
# Vercel, Netlify, or GitHub Pages
```

**Environment Management**
- Environment variables
- API key security
- CORS configuration

---

## 🛠️ Essential Tools & Setup

### Development Environment
```bash
# Required installations
1. Node.js (v18+): https://nodejs.org/
2. VS Code: https://code.visualstudio.com/
3. Git: https://git-scm.com/

# VS Code Extensions
- TypeScript Importer
- Prettier - Code formatter
- ESLint
- Auto Rename Tag
- Bracket Pair Colorizer
```

### API Keys You'll Need
1. **Google Maps API Key**: [Get it here](https://developers.google.com/maps/documentation/javascript/get-api-key)
2. **Google AI API Key**: [Get it here](https://ai.google.dev/)

---

## 📚 Recommended Learning Resources

### Free Resources
1. **freeCodeCamp**: Complete web development course
2. **JavaScript.info**: Comprehensive JavaScript guide
3. **TypeScript Handbook**: Official TypeScript documentation
4. **MDN Web Docs**: Web development reference
5. **Google Developers**: Maps and AI documentation

### Paid Resources (Optional)
1. **Frontend Masters**: Advanced JavaScript and TypeScript courses
2. **Udemy**: Specific courses on Google Maps integration
3. **Pluralsight**: Comprehensive web development paths

### YouTube Channels
1. **Traversy Media**: Web development tutorials
2. **The Net Ninja**: TypeScript and modern JavaScript
3. **Academind**: Comprehensive programming courses
4. **Google Developers**: Official tutorials

---

## 🎯 Weekly Milestones & Checkpoints

### Week 1-2 Checkpoint
- [ ] Can create a responsive webpage
- [ ] Understand JavaScript basics
- [ ] Can manipulate DOM elements
- [ ] Built a simple interactive project

### Week 3-4 Checkpoint
- [ ] Understand TypeScript syntax
- [ ] Can define interfaces and types
- [ ] Converted a JavaScript project to TypeScript
- [ ] Understand compilation process

### Week 5-6 Checkpoint
- [ ] Can initialize Google Maps
- [ ] Can add markers and popups
- [ ] Understand map events
- [ ] Built a functional map application

### Week 7-8 Checkpoint
- [ ] Can make API calls
- [ ] Understand async/await
- [ ] Integrated external APIs
- [ ] Handle errors properly

### Week 9 Checkpoint
- [ ] Understand OOP concepts
- [ ] Can use design patterns
- [ ] Code is well-structured
- [ ] Proper event handling

### Week 10-13 Checkpoint
- [ ] Complete working application
- [ ] All features implemented
- [ ] Code is clean and documented
- [ ] Application is responsive

### Week 14-16 Checkpoint
- [ ] Tests written and passing
- [ ] Application deployed
- [ ] Performance optimized
- [ ] Documentation complete

---

## 🚨 Common Pitfalls to Avoid

1. **Skipping Fundamentals**: Don't jump to complex topics without basics
2. **Not Practicing**: Read + Code + Build projects
3. **Ignoring TypeScript**: Learn it properly, don't use `any` everywhere
4. **Poor Error Handling**: Always handle API failures
5. **No Version Control**: Use Git from day one
6. **Not Testing**: Write tests as you build
7. **Overengineering**: Start simple, add complexity gradually

---

## 💡 Pro Tips

1. **Build Projects**: Theory is good, but building is better
2. **Join Communities**: 
   - [Stack Overflow](https://stackoverflow.com/)
   - [Reddit r/webdev](https://www.reddit.com/r/webdev/)
   - [Discord communities](https://discord.gg/web)
3. **Read Code**: Study well-written open-source projects
4. **Document Everything**: Write clear comments and documentation
5. **Iterate**: Build, test, improve, repeat

---

## 🎓 Final Project Requirements

By the end, you should have:
- [ ] Interactive map with multiple locations
- [ ] AI-powered location extraction
- [ ] Two modes: Explorer and Day Planner
- [ ] Timeline view for day plans
- [ ] Export functionality
- [ ] Responsive design
- [ ] Proper TypeScript implementation
- [ ] Basic testing
- [ ] Deployed application
- [ ] Complete documentation

---

## Next Steps After Completion

1. **Add More Features**: User accounts, saved plans, sharing
2. **Learn a Framework**: React, Vue, or Angular
3. **Backend Development**: Node.js, Python, or Go
4. **Mobile Development**: React Native or Flutter
5. **Advanced Topics**: WebGL, WebAssembly, PWAs

---

**Remember**: This is a marathon, not a sprint. Take your time, practice regularly, and don't hesitate to revisit topics. The key is consistent daily practice and building real projects.

Good luck on your coding journey! 🚀


# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
