// Jeg importerer de forskellige liberies
const express = require("express")
const sqlite3 = require('sqlite3').verbose();
const http = require("http");
const https = require('https');
var crypto = require('crypto');
const session = require("express-session");
const bodyParser = require("body-parser");
const path = require('path');
const fs = require('fs');

// Læser TLS certifikaterne and key fra fil sytemerne.
const options = {
  key: fs.readFileSync('dis-key.pem'),
  cert: fs.readFileSync('dis-cert.pem'),
  rejectUnathorized: false,
};

// Gør det til en express applikation og konfigurerer til at bruge de statiske filer fra Views
app = express();
app.use(express.static(__dirname + '/Views'))

// Opretter en https-server det lytter til port 3000
const server = https.createServer(options, app);

server.listen(3000, function(){
  console.log('Server started on port 3000')
});


//Opretter en database med SQLite
const db = new sqlite3.Database('./db.sqlite');
db.serialize(function() {
  db.run('create table if not exists users (userId integer primary key, username text not null, password text not null)');
});

// Tilføjer user til min tabel i db 
const addUserToDatabase = (username, password) => {
//Laver en SQL-forespørgsel, der indsætter værdierne fra username og password ind i tabellen 
  db.run(
    'insert into users (username, password) values (?, ?)', 
    [username, password], 
    // Call-back funktion der kaster kan kaste en fejl tilbage
    function(err) {
      if (err) {
        console.error(err);
      }
    }
  );
}

//Hasher password og beskederne med "crypto"-modulet i Node.js:
const HASHING = (password, message) => {
  const MD5 = crypto.createHash('md5'); 
  const value = 'Values for the hashing'; //Øger kompleksitet af hashede password 
  return MD5.update(password, message + value).digest('hex'); //Returnerer unikt hexadecimal værdi
}

//Henter user-data fra db 
const getUserData = (userName) => {
  return new Promise((resolve, reject) => {  
    db.all(
      'select * from users where userName=(?)',
      [userName], 
      (err, rows) => {
        if (err) {
          console.error(err);
          return reject(err);
        }
        return resolve(rows);
      }
    );
  })
}

// Express-session-modulet anvendes til at konfigurere sessionen for applikationen
//https://www.section.io/engineering-education/session-management-in-nodejs-using-expressjs-and-express-session/
app.use(
    session({
        secret: "thisismysecrctekeyfhrgfgrfrty84fwir767", //Sikrer at værdien kun kan ændres af serveren
        name: "uniqueSessionID", //Navnet på session-cookien, der gemmes i browseren
        saveUninitialized: false, //Angiver den nye session der skal gemmes i db, selvom den ikke er ændret
    })
);

// Definerer ruten for hjemmeskærmen
app.get("/index.html", function (req, res) {
  res.sendFile(__dirname + "/index.html");
});


// Tjekker om user er logget ind og omdirigerer derefter user alt efter og de er/ikke er logget ind 
app.get("/", (req, res) => {
    if (req.session.loggedIn) { //Her tjekkes om brugeren ligger i session
        return res.redirect("/index.html");
    } else {
        return res.sendFile("/login.html", { root: path.join(__dirname, "Views") });
    }
});

// Endpoint til selve chatapplikationen hvis user er logget ind 
app.get("/index", (req, res) => {
  if (req.session.loggedIn) {
    res.sendFile(__dirname + '/index.html');
  } else {
    return res.redirect("/");
  }
});

// Autentificerer om login eksiterer i db
app.post("/authenticate", bodyParser.urlencoded(), async (req, res) => {

  // User hentes fra db
  const users = await getUserData(req.body.username)
  console.log({users}, req.body.password);
  // Hvis user ikke findes, omdirigeres der til login-siden
  if (users.length === 0) {     
    console.log("Brugeren ikke fundet")
    return res.redirect("/")
  }
  
  if (users[0].password === HASHING(req.body.password)) {  //Tjekker om password er lig det hashede password i db
      req.session.loggedIn = true;                      //Så er user er logget ind sat til true
      req.session.username = req.body.username;         //Sæt username i session til at være det username der gives i body 
      res.redirect("/index.html");
  } else {
      return  res.sendStatus(401);
  }
});


// Laver et endpoint til at logout og fjerner sessionen fra browseren
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {});
  return res.send("Tak for besøget!"); // Returnerer en sød besked
});

// Der undersøges om user allerede er logget ind og i dette tilfælde omdirigeres der til chatforumet
app.get("/signup", (req, res) => {
  if (req.session.loggedIn) {
      return res.redirect("/index.html");
  } else {
      // Ellers bliver den på signup
      return res.sendFile("signup.html", { root: path.join(__dirname, "public") });
  }
});

// Tjekker om username allerede eksisterer i db og forhindre dermed muligheden for usere med samme login 
app.post("/signup", bodyParser.urlencoded(), async (req, res) => {
  const user = await getUserData(req.body.username)
  if (user.length > 0) {
    return res.send('Brugernavnet eksisterer allerede');
  }

  // Hvis user ikke findes i forvejen, vil den blive tilføjet til db, og password vil blive hashet
  addUserToDatabase(req.body.username, HASHING(req.body.password));
  res.redirect('/');

})  

// Opretter en ny db til message
const dbMessage = new sqlite3.Database('./db.sqlite');

dbMessage.serialize(function() {
  dbMessage.run('create table if not exists messages (messageid integer primary key, username text not null, message text, timestamp integer)');
});

// Tilføjer message til db for message
const addMessageToDatabase = (message) => {
  dbMessage.run(
    'insert into messages (username, message, timestamp) values (?, ?, ?)', // Query til dbMessage
    [message.username, message.message, Date.now()], // Liste over informationer der gemmes i databasen
    function(err) {
      if (err) {
        console.error(err);
      }
    }
    );
  }
  
  // Her laves en ny funktion der henter alle messages fra db
  const getAllMessages = () => {
    return new Promise((resolve, reject) => {  
      dbMessage.all('select * from messages where timestamp = date()', (err, rows) => {
        if (err) {
          console.error(err);
          return reject(err);
        }
        return resolve(rows);
      });
    })
  }
  

// Konfigurerer med socket.io og CORS
//https://socket.io/docs/v3/handling-cors/
const io = require("socket.io")(server, {
  cors: {
    origin: "http://167.99.133.207/", //Denne IP kan oprette forbindelse til serveren
    optionsSuccessStatus: 200,
    credentials: true,
    methods: ["GET", "POST"] //Tillader metoderne GET og POST i CORS-forespørgslerne
  }
});

 // Opretter en socket.io forbindelse 
io.on('connection', function(socket){
  socket.on('join', async function(name){ //Når en ny user slutter sig til
    socket.username = name                //Her gemmes username til socket
    io.sockets.emit("addChatter", name);  //Her hentes "addChatter" fra homepage.js som så printer user på HTML-siden
    
    //Hver gang en ny user slutter sig til chatten, oprettes en automatisk besked 
    const messages = await getAllMessages();
    io.sockets.emit('messages', messages);
    io.sockets.emit('new_message', {username: 'Server', message: 'Velkommen ' + name + '!'});

  });

  // Nye beskeder
  socket.on('new_message', function(message){
    addMessageToDatabase({message: HASHING(message), username: socket.username}); //TMessage bliver tilføjet til db og hashet
    const username = socket.username
    io.sockets.emit("new_message", {username, message}); //Printer beskeden på HTML side
  });
  
  // Når en user afbryder forbindelsen til applikationen og dermed ikke længere er logget ind
  socket.on('disconnect', function(name){
    io.sockets.emit("removeChatter", socket.username);
  });
});




