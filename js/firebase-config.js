/*
  ============================================================
  CONFIGURATION FIREBASE - A REMPLIR
  ============================================================
  1. Va sur https://console.firebase.google.com
  2. Cree un projet (gratuit, plan "Spark" suffit largement)
  3. Ajoute une "Web App" (icone </>)
  4. Copie la config qu'on te donne ici en dessous
  5. Dans "Build > Realtime Database", cree une base de donnees
     (choisis une region proche, ex: europe-west1)
  6. Onglet "Regles" de la Realtime Database, mets pour demarrer
     rapidement en dev (a restreindre plus tard si tu veux) :

     {
       "rules": {
         ".read": true,
         ".write": true
       }
     }

  C'est exactement le meme principe que pour FLASH BRAIN.
  ============================================================
*/

const firebaseConfig = {
  apiKey: "AIzaSyAWgy7xqBMU2k-dLTl1BbkmOwlpthz9OYQ",
  authDomain: "loup-garou-v2.firebaseapp.com",
  databaseURL: "https://loup-garou-v2-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "loup-garou-v2",
  storageBucket: "loup-garou-v2.firebasestorage.app",
  messagingSenderId: "854258643873",
  appId: "1:854258643873:web:a41538b3eb6cbc5d9191e0"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
