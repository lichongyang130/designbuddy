export interface DesignComponent {
  name:string;
  type:string;
  props?:Record<string,unknown>;
}

export const components:DesignComponent[]=[
  {
    name:'HeroSection',
    type:'section'
  },
  {
    name:'Navbar',
    type:'navigation'
  },
  {
    name:'Card',
    type:'component'
  }
];
