$(document).ready(function(){ //Anvender jQuery biblioteket til at kører funktionen når dokumentet er klart
  var socket = io.connect('https://loners.info');//Connecter klient-siden til vores web-socket server der kører på denne IP-adresse
  var username = prompt("Hvad skal dit kaldenavn i LONERS være?");//Laver en popUp-besked til user og efterspørger et kaldenavn
  socket.emit('join', username);//Fortæller serveren at en ny user har joinet og vedhæfter username
  
  

  // Laver en eventListener og tilkobler id'et "chatForm" når en message indsendes
  $("#chatForm").on('submit', function(e){
    e.preventDefault(); //Undgår at siden refresher efter indsendelse
    var message = $("#message").val();//Deklarerer variablen meassage og tilknytter den værdien fra id-"message"
    socket.emit('new_message', message)//Fortæller serveren at der er blevet sent en ny message
    $("#message").val("");//Rydder input-feltet, så den er klar til nye messages
  })

  // Tilføjer HTML message til chat-forummet med tidspunkt
  const addMessageToChat = (message) => {
    const messageElement = document.createElement('li');
   
    var time = new Date().toLocaleTimeString(); //Angiver tidpunktet på beskeden
   
    messageElement.innerText = time
      + ': ' + message.username 
      + ': ' + message.message

    $("#messagesContainer").append(messageElement);
  }


  // Når der modtages en message: {username: '...', message: '...'}
  socket.on('new_message', function(message){
    console.log('message: ', message)
    addMessageToChat(message);
  })


  // Når der modtages en liste af beskeder
  socket.on('messages', function(messages) {
    console.log('messages: ', messages)
    messages.forEach(message => { //Itererer over arrayet af messages for hver message
      addMessageToChat(message); //Kalder funktionen og sender den aktuelle besked som argumentet
    })
  })

  // Når en user har tilsluttet sig til chatten, printer den hvilken user der er online
  socket.on('addChatter', function(name){
    var $chatter = $("<li>", {
      text: name,
      attr: {
        'data-name':name
      }
    })
    $("#chatters").append($chatter)
  })

  // Når en user ikke længere er tilsluttet chatten
  socket.on("removeChatter", function(name){
    $("#chatters li[data-name=" + name +"]").remove()
  })
})
