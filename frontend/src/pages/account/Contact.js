import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useDispatch, useSelector } from "react-redux";
import { getUser } from "../../features/auth/authSlice";

function Contact() {
  const { user, users } = useSelector((state) => state.auth);
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message1, setMessage] = useState("");

  const dispatch = useDispatch();

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Constructing the email message with user information
    var message =
      message1 +
      "\n\nRegards, \n" +
      user?.firstName +
      " " +
      user?.lastName +
      " - " +
      user?.email;

    // Sending a POST request to "/send-email" with email details
    const response = await fetch("/send-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        subject,
        message,
      }),
    });

    if (response.ok) {
      toast.success("Email sent successfully!");
    } else {
      toast.error("Failed to send email!");
    }
  };

  useEffect(() => {
    try {
      dispatch(getUser());
    } catch (error) {}
  }, [dispatch]);

  useEffect(() => {
    if (users) {
      console.log("users: ", users);
    }
  }, [users]);

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-md mx-auto bg-white p-8 border shadow-lg rounded-lg"
    >
      <div className="mb-4">
        <label htmlFor="email" className="block text-gray-700 font-bold mb-2">
          Email address:
        </label>
        <input
          type="email"
          id="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          required
          list="email-list"
        />
        <datalist id="email-list">
          {users
            ? users.map((user) => (
                <option key={user.email} value={user.email} />
              ))
            : null}
        </datalist>
      </div>

      <div className="mb-4">
        <label htmlFor="subject" className="block text-gray-700 font-bold mb-2">
          Subject:
        </label>
        <input
          type="text"
          id="subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          required
        />
      </div>

      <div className="mb-4">
        <label htmlFor="message" className="block text-gray-700 font-bold mb-2">
          Message:
        </label>
        <textarea
          id="message"
          value={message1}
          onChange={(e) => setMessage(e.target.value)}
          className="appearance-none h-32 border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          required
        />
      </div>

      <div className="text-center">
        <button
          type="submit"
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
        >
          Send Email
        </button>
      </div>
    </form>
  );
}

export default Contact;
