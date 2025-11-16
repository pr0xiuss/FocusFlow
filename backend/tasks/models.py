from django.db import models
from django.contrib.auth.models import User
from cloudinary.models import CloudinaryField

# Create your models here.
class Task(models.Model):
    user=models.ForeignKey(User,on_delete=models.CASCADE,null=True,blank=True)
    title=models.CharField(max_length=100)
    description=models.TextField(blank=True,null=True)
    due_date=models.DateField(blank=True,null=True)
    category=models.CharField(max_length=50,blank=True,null=True)
    completed=models.BooleanField(default=False)
    created_at=models.DateTimeField(auto_now_add=True)
    updated_at=models.DateTimeField(auto_now=True)
    parent_task=models.ForeignKey('self',on_delete=models.CASCADE,null=True,blank=True,related_name='subtasks')

    def __str__(self):
        return self.title
    
    def get_depth(self):
        depth=0
        cur=self
        while cur.parent_task:
            depth+=1
            cur=cur.parent_task
        return depth


# ============ PROFILE MODEL ============
class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    profile_picture = CloudinaryField(
        'image',
        default='pfp_kniw7o',
        blank=True,
        null=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.user.username}'s profile"


# Signal to auto-create profile when user is created
from django.db.models.signals import post_save
from django.dispatch import receiver

@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.create(user=instance)

@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    if hasattr(instance, 'profile'):
        instance.profile.save()