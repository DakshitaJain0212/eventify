import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { WebhookEvent } from '@clerk/nextjs/server'
import { createUser, deleteUser, updateUser } from '@/lib/actions/user.actions'
import { clerkClient } from '@clerk/nextjs'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing WEBHOOK_SECRET' }, { status: 500 });
  }

  // Get the headers
  const headerPayload = headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // If there are no headers, return an error
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json({ error: 'Missing Svix headers' }, { status: 400 });
  }

  // Get the body
  let payload;
  try {
    payload = await req.json();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const body = JSON.stringify(payload);

  // Create a new Svix instance
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  // Verify the webhook payload
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return NextResponse.json({ error: 'Webhook verification failed' }, { status: 400 });
  }

  // Extract event data
  const { id } = evt.data;
  const eventType = evt.type;

  try {
    if (eventType === 'user.created') {
      const { id, email_addresses, image_url, first_name, last_name, username } = evt.data;

      const user = {
        clerkId: id,
        email: email_addresses[0]?.email_address ?? '',
        username: username ?? '',
        firstName: first_name ?? '',
        lastName: last_name ?? '',
        photo: image_url ?? '',
      };

      const newUser = await createUser(user);

      if (newUser) {
        await clerkClient.users.updateUserMetadata(id, {
          publicMetadata: {
            userId: newUser._id,
            profile: {
              photo: image_url ?? '', // Ensures it's inside an object
            },
          },
        });
      }

      return NextResponse.json({ message: 'User created successfully', user: newUser });
    }

    if (eventType === 'user.updated') {
      const {id, image_url, first_name, last_name, username } = evt.data;

      const user = {
        firstName: first_name ?? '',
        lastName: last_name ?? '',
        username: username ?? '',
        photo: image_url ?? '',
      };

      const updatedUser = await updateUser(id, user);

      return NextResponse.json({ message: 'User updated successfully', user: updatedUser });
    }

    if (eventType === 'user.deleted') {
      const val = id ?? "";
      const deletedUser = await deleteUser(val);

      return NextResponse.json({ message: 'User deleted successfully', user: deletedUser });
    }

    return NextResponse.json({ message: 'Unhandled event type', eventType, id });
  } catch (error) {
    console.error(`Error processing event (ID: ${id}):`, error);

    return NextResponse.json({
      error: `Internal server error`,
      id: id || 'Unknown',
    }, { status: 500 });
  }
}
