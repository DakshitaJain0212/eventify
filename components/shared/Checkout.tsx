"use client"


import React, { useEffect } from "react";
import { IEvent } from "@/lib/database/models/event.model";
import { Button } from "../ui/button";
import { checkoutOrder, createOrder } from "@/lib/actions/order.actions";
import { v4 as uuidv4 } from "uuid";
import { auth } from '@clerk/nextjs'
import { useUser } from "@clerk/nextjs";

declare global {
  interface Window {
    Razorpay: any;
  }
}

const Checkout = ({ event, userId }: { event: IEvent; userId: string }) => {
const { user } = useUser();
  const userEmail = user?.primaryEmailAddress?.emailAddress || "";
  console.log(userEmail);


  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get("success")) {
      console.log("Order placed! You will receive an email confirmation.");
    }

    if (query.get("canceled")) {
      console.log(
        "Order cancelled -- continue to shop around and checkout when you’re ready."
      );
    }
  }, []);

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const onCheckout = async () => {

    console.log(event.isFree);
    const order = {
      eventTitle: event.title,
      eventId: event._id,
      price: event.price,
      isFree: event.isFree,
      buyerId: userId,
      userEmail: userEmail,
      
    };

    try {
      if (event.isFree) {
        // Directly create an order for free tickets
        const orderData = {
          stripeId: uuidv4(),
          eventId: event._id,
          buyerId: userId,
          totalAmount: "0",
          createdAt: new Date(),
          userEmail: userEmail,
          eventTitle: event.title,
        };

        const newOrder = await createOrder(orderData);
        console.log("Free ticket order successfully created:", newOrder);

        // Redirect user to profile/confirmation page
        window.location.href = `${process.env.NEXT_PUBLIC_SERVER_URL}/profile`;
        return;
      }

      // Load Razorpay SDK dynamically
      const razorpayLoaded = await loadRazorpayScript();
      if (!razorpayLoaded) {
        console.error("Failed to load Razorpay script");
        return;
      }

      const data = await checkoutOrder(order);
      console.log(data);

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: Number(event.price) * 100,
        currency: "INR",
        name: "Eventify",
        description: "Event Ticket Purchase",
        order_id: data.orderId,
        handler: async function (response: any) {
          console.log("Payment successful", response);

          const paymentId = response.razorpay_payment_id;
          console.log("Payment ID:", paymentId);

          // Create order in database
          const orderData = {
            stripeId: paymentId,
            eventId: event._id,
            buyerId: userId,
            totalAmount: event.price.toString(),
            createdAt: new Date(),
            userEmail: userEmail,
            eventTitle: event.title,
          };

          try {
            const newOrder = await createOrder(orderData);
            console.log("Order successfully created:", newOrder);
          } catch (error) {
            console.error("Error creating order:", error);
          }

          // Redirect to confirmation page
          window.location.href = `${process.env.NEXT_PUBLIC_SERVER_URL}/profile`;
        },
        prefill: {
          eventTitle: event.title,
          eventId: event._id,
          price: event.price,
          isFree: event.isFree,
          buyerId: userId,
        },
        theme: {
          color: "#3399cc",
        },
      };

      const rzp1 = new window.Razorpay(options);
      rzp1.open();
    } catch (error) {
      console.error("Payment failed", error);
    } finally {
      console.log("Process completed!");
    }
  };

  return (
    <Button onClick={onCheckout} size="lg" className="button sm:w-fit">
      {event.isFree ? "Get Ticket" : "Buy Ticket"}
    </Button>
  );
};

export default Checkout;
