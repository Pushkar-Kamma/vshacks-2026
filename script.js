const button = document.getElementById("demo-button");
const output = document.getElementById("demo-output");
let clicks = 0;

button.addEventListener("click", function () {
  clicks = clicks + 1;
  output.textContent = "JavaScript works — clicked " + clicks + " times";
});
