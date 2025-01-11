import JWT from 'jsonwebtoken';
import { db } from '../DB/firestore.js';
import { refreshToken } from 'firebase-admin/app';
import { renewAdminToken, renewToken } from '../helper/authHelper.js';

export const requireSignIn = async (req, res, next) => {
  try {
    const token = req.headers.authorization; // Get the token from the request headers
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token is required. Please login again.',
      });
    }

    const decode = JWT.verify(token, process.env.JWT_token);
    req.user_id = decode.id;
    console.log("inside signin", decode.id);
    next();
  } catch (error) {
    console.log(error);
    res.status(401).send("Authorization error")
  }
};

//admin access
export const isStudent = async (req, res, next) => {
  if (req.user_id) {
    try {
      const userRef = db.collection(process.env.studentCollection).doc(req.user_id);
      const response = await userRef.get();
      const user = response.data();
      if (user.role == 1) {
        next();
      } else {
        return res.status(401).send({
          success: false,
          message: 'Unauthorized Access',
        });
      }
    } catch (error) {
      console.log(error);
      res.status(401).send({
        success: false,
        message: 'Error in Student Access',
        error: error,
      });
    }
  }
  else {
    return res.status(400).send("Userid is not provided")
  }
};

//verify token
export const verifyToken = async (req, res, next) => {
  try {
    console.log(req.cookies)
    const accessToken = req.cookies['accessToken']
    const refreshToken = req.cookies['refreshToken']
    console.log("accesstoken:", accessToken, "\n refreshToken:", refreshToken)

    if (!accessToken || !refreshToken) {
      return res.status(401).send({ success: false, loginRequired: true, message: "access or refresh token is not present" })
    }

    const querySnapshot = await db.collection(process.env.userCollection) // replace with your collection name
      .where('accessToken', '==', accessToken)
      .limit(1)
      .get();

    if (querySnapshot.empty) {
      console.log("No matching documents.");
      return res.status(401).send({
        success: false,
        loginRequired: true,
        message: "token has been changed"
      })
    }


    const document = querySnapshot.docs[0];
    console.log('Document data:', document.data());
    const actUserData = document.data();
    if (actUserData.refreshToken === refreshToken) {
      const userData = JWT.verify(accessToken, process.env.JWT_token)
      if (userData) {
        req.userId = userData.userId
        return next()
      }
    }
    return res.status(401).send({ success: false, loginRequired: true, message: "Refresh token is changed" })

  } catch (error) {
    console.log(error)
    if (error.name === 'TokenExpiredError') {
      try {
        const refreshToken = req.cookies['refreshToken']
        const verifiedRefreshToken = JWT.verify(refreshToken, process.env.JWT_token)
        if (verifiedRefreshToken) {
          const { newAccessToken, newRefreshToken } = await renewToken(refreshToken)
          res.cookie("accessToken", newAccessToken, {
            maxAge: Number(process.env.cookieExpiry) * 24 * 60 * 60 * 1000,
            sameSite: "None",
          });

          res.cookie("refreshToken", newRefreshToken, {
            maxAge: Number(process.env.cookieExpiry) * 24 * 60 * 60 * 1000,
            sameSite: "None",
          });
          next()
        }
      } catch (error) {
        if (error.name === 'TokenExpiredError') {
          res.status(401).send({ success: false, loginRequired: true, message: "Both tokens are expired" })
        }
      }
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(401).send({ success: false, loginRequired: true, message: "Invalid token" });
    }
    res.status(500).send("Internal error occured")
  }
}

export const verifyTokenAdmin = async (req, res, next) => {
  try {
    console.log(req.cookies)
    const accessToken = req.cookies['accessToken']
    const refreshToken = req.cookies['refreshToken']
    console.log("accesstoken:", accessToken, "\n refreshToken:", refreshToken)

    if (!accessToken || !refreshToken) {
      // res.redirect(process.env.loginRedirectAdmin)
      return res.status(401).send({
        success: false,
        loginRequired: true,
        message: "Admin is not logged in"
      })
    }

    const querySnapshot = await db.collection(process.env.adminCollection) // replace with your collection name
      .where('accessToken', '==', accessToken)
      .limit(1)
      .get();

    if (querySnapshot.empty) {
      console.log("No matching documents.");
      // res.redirect(process.env.loginRedirectAdmin)
      return res.status(401).send({
        success: false,
        loginRequired: true,
        message: "token has been changed"
      })
    }


    const document = querySnapshot.docs[0];
    console.log('Document data:', document.data());
    const actAdminData = document.data();
    if (actAdminData.refreshToken === refreshToken) {
      const adminData = JWT.verify(accessToken, process.env.JWT_token)
      if (adminData) {
        req.adminId = adminData.username
        return next()
      }
    }
    // res.redirect(process.env.loginRedirectAdmin)
    return res.status(401).send({ success: false, loginRequired: true, message: "Refresh token is changed" })

  } catch (error) {
    console.log(error)
    if (error.name === 'TokenExpiredError') {
      try {
        const refreshToken = req.cookies['refreshToken']
        const verifiedRefreshToken = JWT.verify(refreshToken, process.env.JWT_token)
        if (verifiedRefreshToken) {
          const { newAccessToken, newRefreshToken } = await renewAdminToken(refreshToken)
          res.cookie("accessToken", newAccessToken, {
            maxAge: Number(process.env.cookieExpiry) * 24 * 60 * 60 * 1000,
            sameSite: "None",
          });

          res.cookie("refreshToken", newRefreshToken, {
            maxAge: Number(process.env.cookieExpiry) * 24 * 60 * 60 * 1000,
            sameSite: "None",
          });
          next()
        }
      } catch (error) {
        if (error.name === 'TokenExpiredError') {
          // res.redirect(process.env.loginRedirectAdmin)
          res.status(401).send({ success: false, loginRequired: true, message: "Both tokens are expired" })
        }
      }
    } else if (error.name === 'JsonWebTokenError') {
      // res.redirect(process.env.loginRedirectAdmin)
      return res.status(401).send({ success: false, loginRequired: true, message: "Invalid Token" });
    }
    // res.redirect(process.env.loginRedirectAdmin)
    res.status(500).send({ success: false, loginRequired: true, message: "Something went wrong" })
  }
}