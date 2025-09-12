// ============================
// Simple Login Validation
// ============================

// ✅ Define allowed Gmail accounts & passwords
const users = [
  { email: "naresh476n@gmail.com", password: "12345678" },
  { email: "user2@gmail.com", password: "pass234" },
  { email: "user3@gmail.com", password: "pass345" },
  { email: "user4@gmail.com", password: "pass456" },
  { email: "user5@gmail.com", password: "pass567" }
];

// Handle form submit
document.getElementById("loginForm").addEventListener("submit", function(e) {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const errorEl = document.getElementById("error");

  // Check credentials
  const user = users.find(u => u.email === email && u.password === password);

  if (user) {
    // ✅ Save login state
    localStorage.setItem("loggedIn", "true");
    localStorage.setItem("userEmail", email);

    // Redirect to data.html
    window.location.href = "data.html";
  } else {
    errorEl.textContent = "❌ Invalid Email or Password";
  }
});

// ============================
// Protect data.html
// ============================
// Add this small snippet inside data.html <script> if needed:
//
// if (!localStorage.getItem("loggedIn")) {
//   window.location.href = "index.html";
// }
