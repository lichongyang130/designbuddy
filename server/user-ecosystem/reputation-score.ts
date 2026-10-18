export class ReputationScore {
  calculate(input:{downloads:number;ratings:number}){
    return input.downloads + input.ratings * 10;
  }
}
