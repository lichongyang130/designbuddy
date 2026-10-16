export const templates = {
  landingPage: {
    name:'Landing Page',
    description:'SaaS landing page template'
  },
  dashboard:{
    name:'Dashboard',
    description:'Admin dashboard template'
  },
  mobileApp:{
    name:'Mobile App',
    description:'Mobile application template'
  }
};

export function getTemplate(name:string){
  return templates[name as keyof typeof templates];
}
