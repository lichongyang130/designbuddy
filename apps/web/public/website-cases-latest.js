import { makeScreens } from './website-cases-new.js'
// Fictional brands and local-only prototypes; no transactions are sent.
const concepts = [
 {
  id:'freight-site',name:'NORTH / LINE',domain:'northline.example',style:'freight',shell:'freight',
  theme:['#CEDDE8','#18344A','#285F83','#B4CBDB','#5F7D91','#A6BECE','#36596F'],
  intro:'A clearer way to move things forward.',description:'A cold-chain logistics prototype with a freight manifest layout, steel-blue background, route directory and shipment estimator.',
  nav:[['Services',1],['Network',12],['Insights',17],['Plan',21],['Contact',26]],categories:['Transport','Storage'],
  gift:['Network consultation','A sample planning conversation',50,'11'],
  tool:{label:'Number of shipments',rateLabel:'Assumed cost per shipment ($)',quantity:10,rate:75,disclaimer:'Illustrative estimate only. No shipment, quote or payment is created.'},
  items:[['Regional transport','Transport · sample',75,'02'],['Temperature controlled','Transport · sample',120,'03'],['Cross-dock service','Storage · sample',85,'04'],['Cold storage','Storage · sample',95,'05'],['Delivery planning','Transport · sample',60,'08'],['Inventory review','Storage · sample',45,'09']],
  home:'Every mile matters.',catalog:'Find the right service',catalogLead:'Explore fictional transport and storage services for a connected network.',collection:'All services',faq:'Shipping questions',about:'A network built around care',aboutLead:'An imagined logistics team keeping important goods moving.',process:'How we move',processLead:'Clear handovers and thoughtful planning support a reliable journey.',gallery:'Inside the network',galleryLead:'Explore the places, vehicles and people behind the service.',people:'Our people',peopleLead:'The fictional teams working together across the network.',values:'Care at every step',valuesLead:'A considered approach to the movement and storage of goods.',stories:'Notes from the network',storiesLead:'Stories and ideas about the journey from origin to destination.',
  articles:[['A day at the depot','A closer look at the work behind each departure.'],['Keeping goods moving','Why coordination matters throughout a journey.'],['The last mile','The small details that make a delivery feel seamless.']],
  events:'Start planning',eventsLead:'Explore sample planning sessions and an illustrative shipment estimate.',bookings:['Network discovery call','Planning session'],calc:'Shipment estimate',visit:'Talk to the team',visitLead:'Start a conversation about a fictional logistics network.',thanks:'Thanks for planning with us.'
 },
 {
  id:'listening-site',name:'AFTER / SOUND',domain:'aftersound.example',style:'listening',shell:'listening',
  theme:['#251E2C','#F1E6E8','#ED916A','#3E2F40','#C0A3B1','#62505E','#E0CBD1'],
  intro:'Listen closely to the places around us.',description:'An urban listening project with a dark aubergine palette, editorial programme panel and sample listening session bookings.',
  nav:[['Programmes',1],['Project',12],['Journal',17],['Sessions',21],['Contact',26]],categories:['Sound walks','Listening sessions'],
  gift:['Listening pass','A sample pass for a shared listening session',50,'11'],
  tool:{label:'Number of listeners',rateLabel:'Assumed cost per listener ($)',quantity:8,rate:12,disclaimer:'Illustrative session estimate only. No booking or payment is made.'},
  items:[['Street after dark','Sound walks · sample',12,'02'],['Morning windows','Sound walks · sample',15,'03'],['Neighbourhood echoes','Sound walks · sample',14,'04'],['A quiet room','Listening sessions · sample',18,'05'],['Listening together','Listening sessions · sample',16,'08'],['Field recording notes','Listening sessions · sample',10,'09']],
  home:'The city is listening.',catalog:'Choose a listening experience',catalogLead:'Explore fictional walks and sessions inspired by everyday sound.',collection:'All programmes',faq:'Listening questions',about:'A project about paying attention',aboutLead:'An imagined project for listening to the spaces we share.',process:'Our listening practice',processLead:'Slow down, listen carefully and notice how a place changes.',gallery:'Out in the city',galleryLead:'A collection of streets, rooms and moments from the listening project.',people:'Our contributors',peopleLead:'Meet the fictional people exploring sound and the city.',values:'Make space to listen',valuesLead:'Attentive listening is a way to share and understand a place.',stories:'Stories from the field',storiesLead:'Notes and conversations about listening to everyday life.',
  articles:[['The sound of a street','How a familiar street changes when we take time to listen.'],['Walking after dark','A quiet journey through a city at night.'],['The art of shared listening','What we notice when we share a moment of attention.']],
  events:'Come listen with us',eventsLead:'Explore sample sessions and estimate a group listening experience.',bookings:['Evening sound walk','Listening room session'],calc:'Session estimate',visit:'Say hello',visitLead:'Start a conversation about the sounds and stories of a place.',thanks:'Thanks for listening.'
 },
 {
  id:'living-site',name:'COMMON / ROOMS',domain:'commonrooms.example',style:'living',shell:'living',
  theme:['#F0D1BB','#4C3029','#A95040','#E5B8A0','#87695F','#D4AA96','#684D45'],
  intro:'Better places begin with the people who live there.',description:'A neighbourhood housing concept with a courtyard-inspired split frame, warm clay background, project directory and visit demo.',
  nav:[['Projects',1],['Our approach',12],['Stories',17],['Visit',21],['Contact',26]],categories:['Shared spaces','Neighbourhood life'],
  gift:['Project consultation','A sample conversation about a shared space',50,'11'],
  tool:{label:'Number of participants',rateLabel:'Assumed workshop cost per person ($)',quantity:12,rate:15,disclaimer:'Illustrative workshop estimate only. No visit, contract or payment is created.'},
  items:[['The shared courtyard','Shared spaces · sample',25,'02'],['A place to gather','Shared spaces · sample',30,'03'],['Neighbourhood kitchen','Neighbourhood life · sample',20,'04'],['The common room','Shared spaces · sample',28,'05'],['Street-level studio','Neighbourhood life · sample',24,'08'],['Garden workshop','Neighbourhood life · sample',18,'09']],
  home:'Room for life together.',catalog:'Explore the projects',catalogLead:'Discover fictional spaces for neighbours to meet, make and share.',collection:'All projects',faq:'Project questions',about:'Homes are more than rooms',aboutLead:'A fictional housing project centred on the spaces between front doors.',process:'Designing together',processLead:'Listening to neighbours is a starting point for a better shared space.',gallery:'Inside the neighbourhood',galleryLead:'Explore the buildings, rooms and streets that shape a community.',people:'Our collaborators',peopleLead:'Meet the fictional residents and designers working together.',values:'Built for belonging',valuesLead:'A neighbourhood becomes stronger when everyone has room to participate.',stories:'Stories from the neighbourhood',storiesLead:'Ideas and conversations about sharing space and making a home.',
  articles:[['A shared front door','The little moments that make a building feel like home.'],['Room for a conversation','Why places to gather matter in everyday life.'],['A courtyard in common','A look at the value of shared outdoor space.']],
  events:'Come meet the neighbours',eventsLead:'Explore example visits or estimate a community workshop.',bookings:['Neighbourhood walk','Community workshop'],calc:'Workshop estimate',visit:'Get in touch',visitLead:'Begin a conversation about the places we share.',thanks:'Thanks for stopping by.'
 }
]
export const LATEST_SITE_DEFINITIONS=concepts.map(s=>({...s,screens:makeScreens(s)}))
