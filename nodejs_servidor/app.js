const express = require('express')
const multer = require('multer');
const fetch = require('cross-fetch');
const fs = require('fs');
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
})

// Endpoint validar usuari
app.post('/api/user/validate', async (req, res) => {
  console.log("En validar usuari");
})

// Endpoint descripcio imatges
app.post('/api/maria/image', upload.array('file'), async (req, res) => {
  console.log("In endpoint maria/image")
  const reqBody = req.body;
  const base64Images = [];

  // User validado
  if (!tokenValidation(reqBody.token)) {
    res.status(400).json({ status: "ERROR", message: 'Token not valid', data:{} });
    return;
  }

  for (const file of req.files) {
    const base64StringImg = file.buffer.toString('base64');
    base64Images.push(base64StringImg);
  }

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
      const reader = response.body.getReader();
      while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          if (value != null) {
            const jsonString = new TextDecoder().decode(value);
            separatedJsonArray = jsonString.split("\n");
            console.log('Raw JSON:', jsonString);
            separatedJsonArray = separatedJsonArray.filter(e => e !== '')
            console.log(separatedJsonArray);

            if (separatedJsonArray.length > 1) {
              for (let index = 0; index < separatedJsonArray.length; index++) {
                const element = separatedJsonArray[index];
                const jsonData = JSON.parse(element);
                console.log(jsonData.response);
                res.write(jsonData.response);
              }
            } else {
              const jsonData = JSON.parse(jsonString);
              console.log(jsonData.response);
              res.write(jsonData.response);
            }
            
          }
          
      }

      const OkResponse = JSON.stringify({status: "OK", message: 'Succesful', data:{}});
      res.write(OkResponse); 
      res.end("");
    })
    
    .catch(error => {
      console.error('Error:', error);
      res.status(400).json({ status: "ERROR", message: 'Wrong call', data:{} });
    });

})

// Funcion para en un futuro validar el token
function tokenValidation(providedToken) {
  // de momento esta validacion dummy
  if (providedToken =="123456789") {
    return true;
  }

  return false;
}