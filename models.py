import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime, ForeignKey, select, delete, desc
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app import db

class Conversation(db.Model):
    __tablename__ = "conversations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(100), nullable=False, default="محادثة جديدة")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationship with messages (one-to-many)
    messages: Mapped[list["Message"]] = relationship(
        "Message",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="Message.created_at",
        lazy="selectin"
    )

    def add_message(self, role: str, content: str):
        """ Helper method to add a message to this conversation """
        new_message = Message(
            conversation_id=self.id,
            role=role,
            content=content
        )
        db.session.add(new_message)
        self.updated_at = datetime.now(timezone.utc)
        return new_message

    def to_dict(self):
        """ Serialize conversation and its messages to a dictionary """
        return {
            "id": str(self.id),
            "title": self.title,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "messages": [message.to_dict() for message in self.messages]
        }

    @classmethod
    def get_by_id(cls, conversation_id):
        """Get a conversation by ID"""
        try:
            uuid_id = uuid.UUID(conversation_id)
            return db.session.execute(select(cls).filter_by(id=uuid_id)).scalar_one_or_none()
        except (ValueError, TypeError):
            return None

    @classmethod
    def get_all_conversations(cls):
        """Get all conversations ordered by updated_at"""
        return db.session.execute(
            select(cls).order_by(desc(cls.updated_at))
        ).scalars().all()

    def __repr__(self):
        return f"<Conversation(id={self.id}, title='{self.title}')>"


class Message(db.Model):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("conversations.id"), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # 'user' or 'assistant'
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Back-reference to conversation (many-to-one)
    conversation: Mapped["Conversation"] = relationship("Conversation", back_populates="messages")

    def to_dict(self):
        """ Serialize message to a dictionary """
        return {
            "id": self.id,
            "conversation_id": str(self.conversation_id),
            "role": self.role,
            "content": self.content,
            "created_at": self.created_at.isoformat()
        }

    @classmethod
    def delete_by_conversation_id(cls, conversation_id):
        """Delete all messages for a conversation"""
        db.session.execute(delete(cls).where(cls.conversation_id == conversation_id))
        db.session.commit()

    def __repr__(self):
        return f"<Message(id={self.id}, role='{self.role}', conv_id={self.conversation_id})>"
