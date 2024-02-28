const express = require('express')
const multer = require('multer');
//const fetch = require('cross-fetch');
//const fs = require('fs');
const url = require('url');
const { isNullOrUndefined } = require('util');


const app = express()
//const port = process.env.PORT || 3000
const port = process.env.PORT || 80

// Configurar la rebuda d'arxius a través de POST
const storage = multer.memoryStorage(); // Guardarà l'arxiu a la memòria
const upload = multer({ storage: storage });

function isBlank(str) {
  return (!str || /^\s*$/.test(str));
}

// Tots els arxius de la carpeta 'public' estàn disponibles a través del servidor
// http://localhost:3000/
// http://localhost:3000/images/imgO.png
app.use(express.static('public'))

// Configurar per rebre dades POST en format JSON
app.use(express.json());

// Activar el servidor HTTP
const httpServer = app.listen(port, appListen)
async function appListen() {
  console.log(`Listening for HTTP queries on: http://localhost:${port}`)
}

// Tancar adequadament les connexions quan el servidor es tanqui
process.on('SIGTERM', shutDown);
process.on('SIGINT', shutDown);
function shutDown() {
  console.log('Received kill signal, shutting down gracefully');
  httpServer.close()
  process.exit(0);
}

// Endpoint registrar usuari
app.post('/api/user/register', async (req, res) => {
  console.log("En registre d'usuari");
  const textPost = req.body;
  serverBody = {nickname : textPost.name, telefon:textPost.phone, email: textPost.email, codi_validacio:"123456789"};
  //console.log(textPost);
  try {
    const response = await fetch('http://localhost:8080/api/usuari/registrar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(serverBody)
    });

    const data = await response.json();
    //console.log(data);
    if (data.status === "OK") {
      data.message = "User added";
      sendValidationSMS(data.data.codi_validacio, textPost.phone);
      data.data = {};
    } else {
      data.message = "Couldn not add user";
      data.status = "ERROR";
      data.data = {};
    }
    console.log(data);
    res.send(data); // Send response from your database to the client
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
})

// Endpoint validar usuari
app.post('/api/user/validate', async (req, res) => {
  console.log("En validar usuari");

  const textPost = req.body;
  let objRequest = {telefon: textPost.phone, codi_validacio: textPost.number};
  console.log("Body to DBAPI = " + JSON.stringify(objRequest));

  try {
    const response = await fetch('http://localhost:8080/api/usuari/validar',{
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(objRequest)
    });

    const data = await response.json();
    console.log(data);

    res.send(data);
    return;

  } catch (error) {
    console.error(error);
  }
  res.send({status: "ERROR", message: "Error al validar l'usuari", data: {}});
  
})

// Endpoint descripcio imatges
app.post('/api/maria/image', upload.array('file'), async (req, res) => {
  console.log("In endpoint maria/image")
  const reqBody = req.body;
  const base64Images = [];

  // Variables resposta IA
  let idRequest;
  let textResponseIA = "";

  for (const file of req.files) {
    const base64StringImg = file.buffer.toString('base64');
    base64Images.push(base64StringImg);
  }

  // registrar petició model
  const responseDBAPIrequest = await saveRequestDBAPI("llava", reqBody.prompt, reqBody.token, base64Images);
  console.log(responseDBAPIrequest);
  if (responseDBAPIrequest.status !== "OK") {
    console.log("no se pudo registrar en DBAPI, saliendo...");
    return;
  }

  // Peticio bona, guardem Id
  idRequest = responseDBAPIrequest.data.id;

  //const url = "http://localhost:11434/api/generate";
  const url = "http://192.168.1.14:11434/api/generate";
  
  var textImagePrompt = reqBody.prompt
  if (isBlank(textImagePrompt)) {
    console.log("texto vacio");
    textImagePrompt =  "describe this image";
  }
  const data = {"model":"llava", "prompt": textImagePrompt, "images":base64Images};

  fetch(url, {
    method: 'POST', 
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data)
  })
    .then(async response => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      //console.log(response.body)
      const reader = response.body.getReader();
      while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          if (value != null) {
            const jsonString = new TextDecoder().decode(value);
            separatedJsonArray = jsonString.split("\n");
            //console.log('Raw JSON:', jsonString);
            separatedJsonArray = separatedJsonArray.filter(e => e !== '')
            //console.log(separatedJsonArray);

            if (separatedJsonArray.length > 1) {
              for (let index = 0; index < separatedJsonArray.length; index++) {
                const element = separatedJsonArray[index];
                const jsonData = JSON.parse(element);
                res.write(jsonData.response);
                console.log(jsonData.response);
                textResponseIA += jsonData.response;
              }
            } else {
              const jsonData = JSON.parse(jsonString);
              
              res.write(jsonData.response);
              console.log(jsonData.response);
              textResponseIA += jsonData.response;
            }
            
          }
          
      }
      // guardem resposte a DBAPI;
      saveMariaRequestResponse(idRequest, textResponseIA);

      const OkResponse = JSON.stringify({status: "OK", message: 'Succesful', data:{}});
      res.write(OkResponse); 
      res.end("");
    })
    
    .catch(error => {
      console.error('Error:', error);
      res.status(400).json({ status: "ERROR", message: 'Wrong call', data:{} });
    });

})

app.post('/api/user/login', async (req, res) => {
  console.log("En user login");

  const textPost = req.body;
  let objRequest = {email: textPost.email, password: textPost.password};
  console.log("Body to DBAPI = " + JSON.stringify(objRequest));

  try {
    const response = await fetch('http://localhost:8080/api/usuari/login',{
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(objRequest)
    });

    const data = await response.json();
    console.log(data);

    res.send(data);
    return;

  } catch (error) {
    console.error(error);
  }
  res.send({status: "ERROR", message: "Error a login administrador", data: {}});
});

// funcion para guardar petición de mistral a db
async function saveRequestDBAPI(model, prompt, token,filesList) {
  var objRequest = {"model":model, "prompt":prompt, "imatges":filesList};

  try {
    const response = await fetch('http://localhost:8080/api/peticions/afegir',{
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
	'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(objRequest)
    });

    const data = await response.json();
    console.log(data);
    
    return data;
    
  } catch (error) {
    console.error(error);
  }

}

// funcion para enviar respuesta IA a DBAPI
async function saveMariaRequestResponse(id, prompt) {
  let reqBody = {};
  reqBody.id_peticio = id;
  reqBody.text_generat = prompt;

  try {
    const response = await fetch('http://localhost:8080/api/respostes/afegir',{
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(reqBody)
    });

    const data = await response.json();
    console.log(data);
    
  } catch (error) {
    console.error(error);
  }
}

// funcion para enviar SMS a client al registrarse
async function sendValidationSMS(validation_code, receiver) {
  const api_token = '9IaWFkuHTbW1inR6dQ6XuMeV3Fzlu9wGMNYLVaaMlgY98N4aXyWWfThW4kUcnuxR'; // Replace with your actual API token
  const username = 'ams24'; // Replace with your actual username
  const text = validation_code; // Assuming validation_code is provided as a parameter

  const url = `http://192.168.1.16:8000/api/sendsms/?api_token=${api_token}&username=${username}&text=${validation_code}&receiver=${receiver}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log("sms enviado")
    
  } catch (error) {
    console.error(error);
  }
}

