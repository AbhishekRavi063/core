const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const admin = require('firebase-admin');
const ejs = require('ejs');
const cors = require('cors'); // Add this line for CORS


const app = express();
const PORT = process.env.PORT || 3000;

// Set up Firebase Admin SDK
const serviceAccount = require('./firebase_DB.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

app.set('view engine', 'ejs'); // Set EJS as the view engine

app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
}));
app.use(cors({
  origin: 'https://test-0ohy.onrender.com', // Replace with your frontend origin
  // Other CORS options
}));
app.use(cors());

// Serve signup page with Firebase Phone Auth
app.get('/signup', (req, res) => {
  res.sendFile(__dirname + '/html/signup.html');
});

// Serve signup page with Firebase Phone Auth
app.post('/signup', async (req, res) => {
  try {
    const { name, phone, vehicleNumber, autoName, email, password , cnfpassword, swipeStatus='off'} = req.body;

    const emailExists = await isEmailExists(email);
    const phoneExists = await isPhoneExists(phone);

    if (emailExists || phoneExists) {
      return res.render('signup', { error: 'Email or Phone Number already exists' });
    }

    // Check if the password and confirm password match
    if (password !== cnfpassword) {
      return res.render('signup', { error: 'Password and Confirm Password do not match' });
    }
    const user = {
      name,
      phone,
      vehicleNumber,
      autoName,
      email,
      password,
      swipeStatus: 'off', // Set swipeStatus to 'off' for the new user
    };

    await db.collection('cabs').doc(phone).set(user);

    res.sendFile(__dirname + '/html/login.html');
  } catch (error) {
    console.error(error);
    res.render('signup',{error:'Error during signup'});
  }
});


// Serve login page
app.get('/login', (req, res) => {
  res.sendFile(__dirname + '/html/login.html');
});

// Handle login form submission using Firebase Authentication
app.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;

    // Check if the identifier is an email or a phone number
    let userSnapshot;
    if (identifier.includes('@')) {
      // If the identifier contains '@', assume it's an email
      userSnapshot = await db.collection('cabs').where('email', '==', identifier).get();
    } else {
      // Otherwise, assume it's a phone number
      userSnapshot = await db.collection('cabs').where('phone','==',identifier).get();
    }

    if (userSnapshot.empty) {
      return res.render('login',{error:'User not found'});
    }

    const userDoc = userSnapshot.docs[0];
    const userData = userDoc.data();

    if (userData.password !== password) {
      return res.render('login',{error:'Invalid password'});
    }

    req.session.user = userData;

    res.redirect('/profile');
  } catch (error) {
    console.error(error);
    res.render('login',{error:'Error during login'});
  }
});


 //Serve change password page
app.get('/changepassword', (req, res) => {
  res.sendFile(__dirname + '/html/changepassword.html');
});

// Handle change password form submission
app.post('/changepassword', async (req, res) => {
  try {
    const { phoneNumber, newPassword } = req.body;

    const userSnapshot = await db.collection('cabs').doc(phoneNumber).get();

    if (!userSnapshot.exists) {
      return res.status(400).send('User not found');
    }

    // Update the user's password
    await db.collection('cabs').doc(phoneNumber).update({
      password: newPassword,
    });

    res.send('Password changed successfully. Please log in with your new password.');
    res.redirect('/login');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error changing password');
  }
});


// Serve profile page
app.get('/profile', (req, res) => {
  if (req.session.user) {
    // Render the profile page with user data
    res.render('profile', { user: req.session.user });
  } else {
    res.redirect('/login');
  }
});

// Implement swipe functionality
app.post('/swipe', async (req, res) => {
  try {
      console.log('Reached /swipe endpoint');
      const { status } = req.body;

      // Get the user's phone number from the session
      const phoneNumber = req.session.user.phone;

      console.log('Updating swipe status for user:', phoneNumber);

      // Send PATCH request to update cab's active status

      // Update the user's swipe status in the database
      await db.collection('cabs').doc(phoneNumber).update({
          swipeStatus: status === 1 ? '1' : '0',
      });

      res.send('Swipe status updated successfully.');
  } catch (error) {
      console.error(error);
      res.status(500).send('Error updating swipe status');
  }
});


// Implement logout logic
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error(err);
    }
    res.redirect('/login');
  });
});

app.use(express.static('html'));
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}/login`);
});

async function isEmailExists(email) {
  const emailSnapshot = await db.collection('cabs').where('email', '==', email).get();
  return !emailSnapshot.empty;
}

async function isPhoneExists(phone) {
  const phoneSnapshot = await db.collection('cabs').doc(phone).get();
  return phoneSnapshot.exists;
}
