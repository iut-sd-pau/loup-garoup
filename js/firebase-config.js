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
  apiKey: "REMPLACE_MOI",
  authDomain: "REMPLACE_MOI.firebaseapp.com",
  databaseURL: "https://REMPLACE_MOI-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "REMPLACE_MOI",
  storageBucket: "REMPLACE_MOI.appspot.com",
  messagingSenderId: "REMPLACE_MOI",
  appId: "REMPLACE_MOI"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
